/* w137: rivals' special pets (issue #104, phase 7). Loads after w136-petctx.js; changes earlier parts only by
   reassignment (saved originals carry the wW137 prefix).

   Each rival club brings its own pet to its matches (FOE_PETS in data/pets.js, one for each club, never hatched or
   bought): the Ironmaw Marauders a Wyvern Hatchling, the Mirewood Hexers a Will-o'-Wisp, the Gallowmere Banshees a
   Shrieker Sprout, the Cragspire Tusks a Basilisk Hatchling, the Frostfang Glaciers a Remorhaz Grub, the Duskhollow
   Feasters a Darkmantle, the Rattlebone Rollers a Crawling Claw, the Bramblegate Brutes a Griffon Chick. A club's
   match is a cup round against it or a road meeting with it (the same as its head-to-head record). At kickoff the
   Realm sets RUN.foePet (its kind, and its skill: the match's tier), and the card battle plays it from the other side
   (engine/pets.js, foePetOn); in any other match there is none. The match card says which pet a club brings, and what
   it does.

   W_RIVAL_PET, wRivalPetOf(enc)
   Wrapped: wKickoff (wW137Kickoff: RUN.foePet), wReturnToWorld and wMatchLost (wW137ReturnToWorld, wW137MatchLost:
   RUN.foePet cleared as the match ends), wPreGame (wW137PreGame: the line on the match card), renderHelp
   (wW137RenderHelp: #wHelpPetRivals). */

const W_RIVAL_PET = Object.fromEntries(Object.keys(FOE_PETS).map(k => [FOE_PETS[k].club, k]));
// the club a match is against (a cup round, a road meeting), and its pet
function wRivalPetOf(enc) {
  const W = enc && enc.world, ref = (W && W.ref) || {};
  const club = W ? (W.kind === 'cup' ? ref.club : W.kind === 'event' ? ref.rival : null) : null;
  return club && W_RIVAL_PET[club] ? { club, kind: W_RIVAL_PET[club] } : null;
}
const wW137Kickoff = wKickoff;
wKickoff = function (enc) {
  const r = wRivalPetOf(enc);
  RUN.foePet = r ? { kind: r.kind, club: r.club, skill: clamp((enc.world && enc.world.tier) || 1, 1, 3) } : null;
  return wW137Kickoff.apply(this, arguments);
};
// (the match over, won or lost: no club's pet hangs about for the next one)
const wW137ReturnToWorld = wReturnToWorld, wW137MatchLost = wMatchLost;
wReturnToWorld = function () { if (RUN) RUN.foePet = null; return wW137ReturnToWorld.apply(this, arguments); };
wMatchLost = function () { if (RUN) RUN.foePet = null; return wW137MatchLost.apply(this, arguments); };
const wW137PreGame = wPreGame;
wPreGame = function (enc) {
  wW137PreGame.apply(this, arguments);
  const r = wRivalPetOf(enc), box = document.querySelector('#modalBox .wpgtxt'); if (!r || !box) return;
  const F = FOE_PETS[r.kind];
  box.insertAdjacentHTML('beforeend', `<p class="hint wrivalpet">The ${esc(CLUBS[r.club].name)} bring their <b>${esc(F.n)}</b>, ${petA(F.from)} ${esc(F.from)}: ${esc(F.trait.d)} ${esc(F.power.d)} Once a match it uses <b>${esc(F.trick.n)}</b>: ${esc(F.trick.d)}</p>`);
};
const wW137RenderHelp = renderHelp;
renderHelp = function () {
  wW137RenderHelp();
  const h = $('wHelpPetCtx') || $('wHelpPets'); if (!h || $('wHelpPetRivals')) return;
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPetRivals"><b>Rivals' pets.</b> Every rival club brings its own pet to its matches, one you can't hatch or buy: ${Object.keys(FOE_PETS).map(k => `the ${esc(CLUBS[FOE_PETS[k].club].name)}' ${esc(FOE_PETS[k].n)}`).join(', ')}. Each has its trait and power, and a trick it uses once a match, better timed by tougher teams. The match card says what it does. Your own pet can answer it: the Rustnibbler eats the Block it gives, the Jellycube swallows a debuff it lays.</p>`);
};
