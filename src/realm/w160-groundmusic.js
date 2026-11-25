/* w160: each engine's own view plays its ground's music (issue #120, phase 2). Loads after w158-listsfeel.js.

   Every ground has its own theme (w26's THEMES.wg_<ground>), heard while you walk the ground. Once a match opened an
   engine's view, Sudden Death's act music took over (musicWanted falls back to ['act0', 'calm'] off the fight view).
   Now the view plays its ground's theme: calm while no match is live there (the ground's tune, quietly: w50's ambient
   bed stays on the maps), fight while one is, hype at the big moments an engine shows (a knockdown's count in the ring,
   the tilt for the crown at the Lists; the other engines have no such moment in their state, so they stay on fight).
   A boxing card is live between its bouts, until its result. Jousting's rule was w158's own wrapper; it is a row here
   now, the same rule. Baseball's Diamond view is left alone: Brimstone Diamond plays its own organ there (w20f).

   The Umbral has no music of its own: a match against the Nadir (its club 'nadir' or 'nadir:<id>', the finale's
   rounds too), or the Lists' Lich or hexes, keeps the music it had, wherever you stand; a light-side match is the
   ground's, even resumed on the dark side.

   W_GRD_MUSIC: the view, its ground's theme, whether a match is live on it (the Realm's own record of the match, WBX,
   WGF, ...: set when one starts, over once it ends, and the engine's own, through its exports), its big moment, and
   its world record (WG.<k>.live, whose club says whether it is the Umbral's).
   Wraps: musicWanted (wW160MusicWanted). */

const W_GRD_MUSIC = {
  ring: { g: 'g_ring', rec: 'bxg', live: () => !!(WBX && ((!WBX.over && wBX.live) || (WBX.card && wBX.card && !wBX.card.result))), hype: () => wBX.phase === 'kd' },
  gridiron: { g: 'g_bowl', rec: 'gfg', live: () => !!(WGF && !WGF.over && wGF.live) },
  court: { g: 'g_court', rec: 'bkg', live: () => !!(WBK && !WBK.over && wBK.live) },
  rink: { g: 'g_rink', rec: 'hkg', live: () => !!(WHK && !WHK.over && wHK.live) },
  links: { g: 'g_links', rec: 'lkg', live: () => !!(WGL && !WGL.over && wGL.G && !wGL.G.over) },
  lanes: { g: 'g_lanes', rec: 'lng', live: () => !!(WBL && !WBL.over && wBL.G && !wBL.G.over) },
  shed: { g: 'g_shed', rec: 'shg', live: () => !!(WCR && !WCR.over && wCR.G && !wCR.G.over) },
  lists: { g: 'g_lists', rec: 'jtg', live: () => { const G = wJT.G; return !!(G && G.teams && !G.over && !G.yard && WJT && !WJT.over); },
    hype: () => wJT.inTilt(), umb: () => { const G = wJT.G; return !!(G && (G.lich || G.hex)); } },
};
// a match against the Nadir: its world record's club, wherever you stand (and a view's own sign, the Lists' Lich)
function wGrdMusicUmb(V) {
  const L = WG && WG[V.rec] && WG[V.rec].live, club = String((L && L.world && L.world.club) || '');
  if (/^nadir(:|$)/.test(club)) return true;
  try { return !!(V.umb && V.umb()); } catch (e) { return false; }
}
const wW160MusicWanted = musicWanted;
musicWanted = function () {
  const base = wW160MusicWanted(), V = W_GRD_MUSIC[UI.view];
  if (!V || !WG || !RUN || UI.screen !== 'run' || !THEMES['wg_' + V.g]) return base;
  if (wGrdMusicUmb(V)) return base;
  let live = false, hype = false; try { live = V.live(); hype = live && !!(V.hype && V.hype()); } catch (e) { live = false; }
  const out = ['wg_' + V.g, hype ? 'hype' : live ? 'fight' : 'calm'];
  MUS.want = out[0];
  return out;
};
