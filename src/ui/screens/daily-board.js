/* p9c: the daily's shared board (issue #60, phase 5). When the game is published as a claude.ai artifact with the db
   and user capabilities, each player's daily result goes to the artifact's shared store, and the Daily page shows
   everyone's for the day. Anywhere else (a saved copy, another host, signed out) the board stays off and the local
   record (run/daily.js) is all there is; a viewer who may read but not write (a Viewer or Commenter on the artifact)
   sees the board without a place on it.

   Store: boards/<viewer id> = { v: 1, '<game>_<yyyymmdd>': rank, <game>: { 'YYYY-MM-DD': shown } }: one document per
   viewer, written only by that viewer (and tidied by the owner), pruned to BOARD_CFG.keep days. The rank is a number,
   so the board can be one ordered query on a top-level field; shown is what a row says. game: 'sd' (Sudden Death's
   daily: rank = the run's score) or 'rd' (the Realm daily, w71: rank from the result, then the margin). Each build is
   its own artifact with its own store. Only ids are stored: names come from user.profiles() each time a board draws.

   Publish with
     capabilities: { db: { rules: [{ path: 'boards', read: 'view', write: 'owner' }, { path: 'boards/{self}', read: 'view', write: 'interact' }] },
                     user: { scopes: ['profile'] } }

   A day's first result stands. Results in this device's record that never reached the board are posted on the next load.
   Wraps recordRun (a daily's result posted, a forfeit too) and renderDaily (Sudden Death's page: today's board and yesterday's). The
   Realm's daily posts and draws through the same functions (w71). LAB never touches the board. */
const BOARD_CFG = { keep: 30, top: 10, wait: 10000, fetch: 200 };
// st: 'off' (no runtime here), 'wait' (asking it), 'on', 'ro' (on, but this viewer's writes are refused)
// mine: your own document as last read or written; names: names resolved so far (by id, for drawing only, never stored);
// local[game]() -> [[key, rank, shown]]: the finished days in this device's record, posted on load when your document
// lacks them (a post that never landed: a network blip, or a runtime that answered late)
const BOARD = { st: 'off', db: null, user: null, uid: null, subs: {}, rows: {}, late: {}, timer: {}, queue: [], busy: Promise.resolve(), fmt: {}, local: {},
  mine: null, names: {}, full: false };
const boardDay = key => key.replace(/-/g, '');
const boardField = (game, key) => game + '_' + boardDay(key);
function boardInit() {
  if (LAB || BOARD.st !== 'off' || typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return;
  BOARD.st = 'wait';
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(async ([db, user]) => {
    const uid = user ? await user.id() : null;
    if (!db || !uid) { BOARD.st = 'off'; BOARD.queue = []; boardRedraw(); return; }
    Object.assign(BOARD, { db, user, uid, st: (await user.can('data.write')) === false ? 'ro' : 'on' });
    for (const f of BOARD.queue.splice(0)) f();
    if (BOARD.st === 'on') boardWrite(boardLocal());
    boardRedraw();
  }).catch(e => { console.warn('daily board', e); BOARD.st = 'off'; boardRedraw(); });
}
// the first day the board keeps: BOARD_CFG.keep days before today
function boardCut() { const d = dayDate(dayKey()); d.setDate(d.getDate() - BOARD_CFG.keep); return dayKey(d); }
function boardLocal() {
  const out = [], cut = boardCut();
  for (const g of Object.keys(BOARD.local)) { try { out.push(...BOARD.local[g]().filter(x => x[0] >= cut).map(x => [g].concat(x))); } catch (e) { console.warn('daily board', e); } }
  return out;
}

/* ---------- posting: one write at a time to your own document ---------- */
function boardPost(game, key, rank, shown) {
  if (LAB) return;
  const go = () => { if (BOARD.st === 'on') boardWrite([[game, key, rank, shown]]); };
  if (BOARD.st === 'wait') BOARD.queue.push(go); else go();
}
// items: [[game, key, rank, shown]]. The first result for a day stands: the daily is one attempt, and a second profile,
// device or cleared record playing it again doesn't replace it.
function boardWrite(items, tries = 0) {
  BOARD.busy = BOARD.busy.then(async () => {
    const ref = BOARD.db.doc('boards/' + BOARD.uid), snap = await ref.get();
    const cur = snap.exists ? JSON.parse(JSON.stringify(snap.data())) : {};
    let changed = false;
    for (const [game, key, rank, shown] of items) {
      const f = boardField(game, key);
      if (cur[f] != null) continue;
      cur[f] = rank; cur[game] = Object.assign({}, cur[game], { [key]: shown }); changed = true;
    }
    // keep the last BOARD_CFG.keep days (counted from today, and never a day posted now)
    const cut = boardCut(), now = new Set(items.map(x => x[1]));
    for (const k of Object.keys(cur)) { const m = /^[a-z]+_(\d{4})(\d\d)(\d\d)$/.exec(k), day = m && `${m[1]}-${m[2]}-${m[3]}`; if (day && day < cut && !now.has(day)) { delete cur[k]; changed = true; } }
    for (const g of Object.keys(cur)) if (cur[g] && typeof cur[g] === 'object') for (const k of Object.keys(cur[g])) if (/^\d{4}-\d\d-\d\d$/.test(k) && k < cut && !now.has(k)) { delete cur[g][k]; changed = true; }
    if (changed) { cur.v = 1; await ref.set(cur); }
    BOARD.mine = cur;
    if (changed) boardRedraw();
  }).catch(e => {
    const code = e && e.code;
    if (code === 'invalid_argument') BOARD.st = 'ro'; // a viewer who may read but not write: the board stays, without their place on it
    else if (code === 'quota_exceeded') BOARD.full = true;
    else if (!tries) setTimeout(() => boardWrite(items, 1), 400 + Math.random() * 800); // transient: once more (and on the next load from the record)
    console.warn('daily board', e); boardRedraw();
  });
  return BOARD.busy;
}

/* ---------- reading: one subscription per day's board ---------- */
function boardWatch(game, key) {
  const id = boardField(game, key);
  if ((BOARD.st !== 'on' && BOARD.st !== 'ro') || BOARD.subs[id]) return;
  BOARD.subs[id] = 'opening'; // before onSnapshot: a snapshot delivered during the call redraws, and must not subscribe again
  // late: null while fetching or answered, 'late' when nothing came in BOARD_CFG.wait, 'err' when it failed
  BOARD.late[id] = null;
  BOARD.timer[id] = setTimeout(() => { BOARD.late[id] = 'late'; boardRedraw(); }, BOARD_CFG.wait);
  const done = how => { clearTimeout(BOARD.timer[id]); BOARD.late[id] = how; };
  const fail = e => {
    console.warn('daily board', e); done('err');
    // the listener is dead: a fresh one is the only way back, after a while (never for a query the store refuses)
    if (!e || e.code !== 'invalid_argument') setTimeout(() => { delete BOARD.subs[id]; boardRedraw(); }, 30000);
    boardRedraw();
  };
  try {
    const un = BOARD.db.collection('boards').where(id, '>', -1e12).orderBy(id, 'desc').limit(BOARD_CFG.fetch).onSnapshot(s => {
      BOARD.rows[id] = s.docs.map(d => { const x = d.data() || {}; return { uid: d.id, rank: x[id], shown: (x[game] || {})[key] || {} }; });
      if (!s.metadata || !s.metadata.fromCache) done(null);
      boardRedraw();
    }, fail);
    if (BOARD.subs[id] === 'opening') BOARD.subs[id] = un;
  } catch (e) { fail(e); }
}

/* ---------- drawing ---------- */
// fmt(shown) -> what a row says; title: the board's heading. Draws what it has, and redraws itself as rows come in.
function boardHTML(game, key, title) {
  if (BOARD.st === 'off') return '';
  return `<div class="dboard" data-board="${game}" data-bkey="${key}" data-btitle="${esc(title)}">${boardInner(game, key, title)}</div>`;
}
function boardInner(game, key, title) {
  boardWatch(game, key); // (once the runtime has answered: a board drawn while asking starts its subscription on the redraw)
  const id = boardField(game, key), rows = BOARD.rows[id], late = BOARD.late[id], fmt = BOARD.fmt[game] || (s => String(s.st || ''));
  let body;
  if (BOARD.st === 'wait' || (!rows && !late)) body = '<p class="hint">Fetching the board…</p>';
  else if (!rows && late === 'late') body = '<p class="hint">The board can’t be reached yet.</p>';
  else if (!rows) body = '<p class="hint">The board isn’t available here.</p>';
  else if (!rows.length) body = `<p class="hint" data-bempty>Nobody has a result on the board yet.</p>`;
  else {
    const me = rows.findIndex(r => r.uid === BOARD.uid), show = rows.slice(0, BOARD_CFG.top).map((r, i) => [r, i + 1]);
    if (me >= BOARD_CFG.top) show.push([rows[me], me + 1]);
    // your result is on the board but below the rows fetched
    else if (me < 0 && BOARD.mine && BOARD.mine[id] != null) show.push([{ uid: BOARD.uid, shown: (BOARD.mine[game] || {})[key] || {} }, `${BOARD_CFG.fetch}+`]);
    const nm = r => r.uid === BOARD.uid ? 'You' : BOARD.names[r.uid] || '…';
    const many = rows.length >= BOARD_CFG.fetch ? `More than ${BOARD_CFG.fetch}` : rows.length;
    body = `<ol class="dbrows">${show.map(([r, pos]) => `<li class="${r.uid === BOARD.uid ? 'dbme' : ''}" data-buid="${esc(r.uid)}"><span class="dbp">${pos}</span><span class="dbn" data-bname="${esc(r.uid)}">${esc(nm(r))}</span><span class="dbr">${esc(fmt(r.shown))}</span></li>`).join('')}</ol>
      ${rows.length > BOARD_CFG.top ? `<p class="hint">${many} on the board.</p>` : ''}${late === 'late' || late === 'err' ? '<p class="hint">This may be out of date.</p>' : ''}`;
  }
  const note = BOARD.st === 'ro' ? '<p class="hint" data-bro>You can see the board, but your results can’t go on it from here.</p>'
    : BOARD.full ? '<p class="hint" data-bfull>The board is full, so your result couldn’t go on it.</p>' : '';
  return `<h4 class="dbh">${esc(title)}</h4>${body}${note}`;
}
function boardRedraw() {
  if (typeof document === 'undefined') return;
  for (const el of document.querySelectorAll('[data-board]')) {
    if (BOARD.st === 'off') { el.remove(); continue; }
    el.innerHTML = boardInner(el.dataset.board, el.dataset.bkey, el.dataset.btitle);
  }
  boardNames();
}
// names, resolved each time a board draws (only ids are stored), and kept for the next draw so rows don't flicker; set as
// text, since they are other people's input
function boardNames() {
  const els = [...document.querySelectorAll('[data-bname]')].filter(e => e.dataset.bname !== BOARD.uid);
  if (!els.length || !BOARD.user) return;
  BOARD.user.profiles([...new Set(els.map(e => e.dataset.bname))]).then(ps => {
    for (const e of els) { const id = e.dataset.bname, p = ps[id]; BOARD.names[id] = (p && p.name) || 'Someone'; e.textContent = BOARD.names[id]; }
  }).catch(() => { });
}

/* ---------- Sudden Death's daily on the board ---------- */
const BOARD_SD_FIN = { win: 1, lose: 1, quit: 1 };
BOARD.fmt.sd = s => `${s.st === 'win' ? 'Won the Cup' : `${s.st === 'quit' ? 'Forfeited' : 'Lost'} in act ${(s.act || 0) + 1}, floor ${(s.floor || 0) + 1}`}: ${s.score || 0} points`;
// a finished day in the local record, as a row (a forfeit counts, as a loss does)
BOARD.local.sd = () => { const days = loadDaily().days; return Object.keys(days).filter(k => BOARD_SD_FIN[days[k].st]).map(k => { const e = days[k];
  return [k, e.score || 0, { st: e.st, score: e.score || 0, act: e.act || 0, floor: e.floor || 0, sw: e.sw || 0 }]; }); };
const recordRunNoBoard = recordRun;
recordRun = function (result) {
  const key = RUN && RUN.daily;
  recordRunNoBoard(result);
  if (!key || LAB || !BOARD_SD_FIN[result] || !RUN) return;
  // from the run itself, as run/daily.js writes the record (which a full localStorage could have missed)
  const score = runScore(RUN);
  boardPost('sd', key, score, { st: result, score, act: RUN.act || 0, floor: RUN.floor || 0, sw: (RUN.stats && RUN.stats.sportsWins) || 0 });
};
const renderDailyNoBoard = renderDaily;
renderDaily = function () {
  renderDailyNoBoard();
  const el = $('pg-daily'), d = el && el.querySelector('.daily'); if (!d || window.__SD_REALM) return;
  const key = dayKey();
  d.insertAdjacentHTML('afterend', boardHTML('sd', key, 'Today’s board') + boardHTML('sd', dayBefore(key), 'Yesterday’s board'));
  boardNames();
};
(() => {
  const css = document.createElement('style');
  css.textContent = `.dboard{max-width:720px;margin:14px 0}.dboard .dbh{margin:0 0 6px}.dbrows{margin:0;padding:0;list-style:none;display:grid;gap:3px}
.dbrows li{display:grid;grid-template-columns:2.2em 1fr auto;gap:12px}.dbrows .dbp{color:var(--dim);text-align:right}.dbrows .dbn{font-weight:700}.dbrows .dbr{color:var(--dim)}.dbrows .dbme .dbn,.dbrows .dbme .dbr{color:var(--torch)}`;
  document.head.appendChild(css);
})();
boardInit();
