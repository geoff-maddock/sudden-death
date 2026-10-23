/* the end of the wBD scope: what the Realm may call (w20-diamond.js). gameOver and showMenu are wrapped here, inside
   the scope, so the Realm hears about a final, or a game given up from the Time out box (its End game goes back to
   the setup menu, which the Realm does not show), without reading Brimstone Diamond's page. */
const bdxGameOver = gameOver;
gameOver = function (walkoff) { const r = bdxGameOver(walkoff); try { if (BDX.onOver) BDX.onOver(); } catch (e) { console.error(e); } return r; };
const bdxShowMenu = showMenu;
showMenu = function () { const r = bdxShowMenu.apply(this, arguments); try { if (BDX.onQuit) BDX.onQuit(); } catch (e) { console.error(e); } return r; };
// start a game straight onto the field, skipping its setup menu: opts as newGame takes them
function bdxStart(opts) { actx(); document.getElementById('menu').hidden = true; document.getElementById('over').hidden = true; PL = null; newGame(opts); }
return {
  G, newGame, simToEnd, start: bdxStart, show: bdxShow, hide: bdxHide,
  get on() { return BDX.on; }, set onOver(f) { BDX.onOver = f; }, set onQuit(f) { BDX.onQuit = f; },
  teams: () => Object.keys(TEAMS)
};
