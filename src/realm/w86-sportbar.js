/* Champions of the Realm: a scoreboard you can read on a phone (issue #80). Football, boxing and basketball draw their
   score bar inside the canvas, 960 wide; on a phone the canvas is 370 wide and the bar's letters are a few pixels tall.
   So at narrow widths (W_SB_MAX and under; w6.css hides it above) each of the three has a strip of real text over its
   canvas: both sides and the score (the side with the ball marked), and the line that says where the game is (the
   down and the spot, the round and its clock, the period with the game and shot clocks). Boxing has each fighter's
   health and stamina as bars. It reads the engines' own state (wGF.G, wBX.G, wBK.G) four times a second while one of
   the three is on show, and changes nothing in them. Baseball has its own panel (bd 33-phone-panel.js).
   The pad buttons under the ring and the court also show their keys (w51-ring.js, w77-court.js, w6.css). */
const W_SB_MAX = 640, W_SB_VIEWS = { gridiron: 'wSbGrid', ring: 'wSbRing', court: 'wSbCourt' };
const wSbState = { timer: 0, last: '' };
const wSbBar = (v, col) => `<i class="wsbbar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${col}"></i></i>`;
// one side of the strip: its colour, its name, the big number, and a line under the name
const wSbSide = (name, col, big, has, sub) => `<div class="wsbside${has ? ' has' : ''}" style="--c:${esc(col)}"><b>${esc(name)}</b>${big == null ? '' : `<strong>${esc(String(big))}</strong>`}${sub || ''}</div>`;
function wSbGridHTML() {
  const G = wGF.G; if (!G || !G.teams) return '';
  const C = wGF.clock(), over = wGF.phase === 'over', togo = G.togo >= 100 - G.ball ? 'goal' : G.togo, spot = G.ball < 50 ? 'own ' + G.ball : G.ball === 50 ? 'midfield' : 'their ' + (100 - G.ball);
  const mid = over ? 'Final' : `${['', '1st', '2nd', '3rd', '4th'][G.down] || ''} & ${togo} · ${spot}`;
  return wSbSide(G.teams[0].name, G.teams[0].color, G.score[0], !over && G.poss === 0) + `<div class="wsbmid"><b>${esc(mid)}</b>${C ? `<small>${esc(C.name)} ${esc(C.text)}</small>` : ''}</div>` + wSbSide(G.teams[1].name, G.teams[1].color, G.score[1], !over && G.poss === 1);
}
function wSbRingHTML() {
  const G = wBX.G; if (!G || !G.F) return '';
  const over = wBX.phase === 'over', side = s => { const f = G.F[s]; return wSbSide(f.n, G.corners[s].color, null, false, `<small>Health</small>${wSbBar(f.hp / 100, '#e0703a')}<small>Stamina</small>${wSbBar(f.staMax ? f.sta / f.staMax : 0, '#5ab8d8')}`); };
  return side(0) + `<div class="wsbmid"><b>${over ? 'Final' : `Round ${G.round} of ${G.rounds}`}</b><small>${over ? '' : `0:${String(Math.max(0, Math.ceil(G.clock))).padStart(2, '0')}`}</small></div>` + side(1);
}
function wSbCourtHTML() {
  const G = wBK.G; if (!G || !G.teams) return '';
  const C = wBK.clock(), over = wBK.phase === 'over', shot = C && G.clock >= G.shot ? ` · shot ${C.shot}` : '';
  return wSbSide(G.teams[0].name, G.teams[0].color, G.score[0], !over && G.poss === 0) + `<div class="wsbmid"><b>${over ? 'Final' : C ? esc(`${C.name} ${C.text}`) : ''}</b><small>${over ? '' : esc(shot.slice(3))}</small></div>` + wSbSide(G.teams[1].name, G.teams[1].color, G.score[1], !over && G.poss === 1);
}
const W_SB_HTML = { gridiron: wSbGridHTML, ring: wSbRingHTML, court: wSbCourtHTML };
// the strip for a view, made the first time it's wanted: just above that view's canvas
function wSbEl(v) {
  let el = $(W_SB_VIEWS[v]); if (el) return el;
  const cv = document.querySelector(`#v-${v} canvas`); if (!cv) return null;
  cv.insertAdjacentHTML('beforebegin', `<div id="${W_SB_VIEWS[v]}" class="wsb" role="status" aria-label="Score"></div>`);
  return $(W_SB_VIEWS[v]);
}
function wSbNarrow() { return innerWidth <= W_SB_MAX; }
// draw the strip for the view on show, if it's a sport and the page is narrow; only touches the page when the words change
function wSbRender() {
  const v = UI.view; if (!W_SB_HTML[v] || !wSbNarrow()) return;
  const el = wSbEl(v); if (!el) return;
  let h = ''; try { h = W_SB_HTML[v](); } catch (e) { h = ''; }
  if (h !== wSbState.last || !el.firstChild) { el.innerHTML = h; wSbState.last = h; }
  el.hidden = !h;
}
const wW86ShowView = showView;
showView = function (v) {
  wW86ShowView(v);
  clearInterval(wSbState.timer); wSbState.timer = 0; wSbState.last = '';
  if (W_SB_HTML[v] && !LAB) { wSbState.timer = setInterval(wSbRender, 250); wSbRender(); }
};
