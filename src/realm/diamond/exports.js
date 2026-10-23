/* the end of the wBD scope: what the Realm may call (w20-diamond.js). gameOver and showMenu are wrapped here, inside
   the scope, so the Realm hears about a final, or a game given up from the Time out box (its End game goes back to
   the setup menu, which the Realm does not show), without reading Brimstone Diamond's page. */
const bdxGameOver = gameOver;
gameOver = function (walkoff) { const r = bdxGameOver(walkoff); try { if (BDX.onOver) BDX.onOver(); } catch (e) { console.error(e); } return r; };
const bdxShowMenu = showMenu;
showMenu = function () { const r = bdxShowMenu.apply(this, arguments); try { if (BDX.onQuit) BDX.onQuit(); } catch (e) { console.error(e); } return r; };
// start a game straight onto the field, skipping its setup menu: opts as newGame takes them
function bdxStart(opts) { actx(); document.getElementById('menu').hidden = true; document.getElementById('over').hidden = true; PL = null; newGame(opts); }
/* a Realm player's baseball ratings, seeded from their kind's player on the two founding clubs (TEMPL: every kind plays
   once, so the kind also gives the position), each of the five stats moved by up to 1 either way */
function bdxRate(kind) {
  const T = TEMPL[kind] || TEMPL.goblin;
  const r = { pos: T.pos, hand: T.hand, wpn: T.wpn, bat: T.bat || null, run: T.run || null, field: T.field || null, ult: ULT_BY_KIND[T.kind] || null, pitches: T.pitches ? T.pitches.slice() : null };
  for (const s of STATS5) r[s] = clamp(T[s] + Math.floor(Math.random() * 3) - 1, 1, 10);
  return r;
}
function bdxTempl(kind) { const T = TEMPL[kind]; return T ? Object.fromEntries(STATS5.map(s => [s, T[s]])) : null; }
// the names and one-line descriptions the Realm shows for powers, ultimates and pitches
function bdxNames() {
  const o = (src, f) => Object.fromEntries(Object.entries(src).map(([k, v]) => [k, f(v)]));
  return { ab: o(AB, v => ({ n: v.name, type: v.type, desc: v.desc })), ult: o(ULT, v => ({ n: v.name, role: v.role, desc: v.desc })),
    pitch: o(PITCHES, v => ({ n: v.name, magic: !!v.magic, desc: v.desc })) };
}
return {
  G, newGame, simToEnd, start: bdxStart, show: bdxShow, hide: bdxHide,
  get on() { return BDX.on; }, set onOver(f) { BDX.onOver = f; }, set onQuit(f) { BDX.onQuit = f; },
  teams: () => Object.keys(TEAMS), rate: bdxRate, templ: bdxTempl, names: bdxNames, stats: STATS5.slice()
};
