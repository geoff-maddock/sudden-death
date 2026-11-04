/* w19b: the engines (issue #9, phase 0). Some sports have a game of their own beside the card game. Each is built in
   its own scope and talks to the Realm through the same small API (start, sim, box, show, hide, pause, audio, on,
   onOver, onQuit, onSnap). W_ENGINES lists them by id: the scope's API, the view it plays in and its sport.
   Brimstone Diamond (wBD, baseball), Cinder Gridiron (wGF, football; src/gf/) and the Anvil Ring (wBX, boxing; src/bx/,
   issue #23). Nothing here is saved. */

const W_ENGINES = { diamond: { api: wBD, view: 'diamond', sport: 'baseball' }, gridiron: { api: wGF, view: 'gridiron', sport: 'football' },
  ring: { api: wBX, view: 'ring', sport: 'boxing' } };
/* an engine's question (Concede?) holds the game still until it closes: askConfirm hears only its two buttons, so this
   runs fn once the box closes however it closes (a button, Escape, a click outside) */
function wAfterAsk(fn) { const t = setInterval(() => { if (!$('modal').hidden) return; clearInterval(t); try { fn(); } catch (e) { console.error(e); } }, 100); }
// on screen: the engine whose view it is shows, and every other one hides
function wEnginesShow(v) {
  for (const E of Object.values(W_ENGINES)) { if (E.view === v) E.api.show(); else if (E.api.on) E.api.hide(); }
}
