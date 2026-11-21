/* w136: pets in context (issue #104, phase 6). Loads after w135-petbond.js; changes earlier parts only by reassignment
   (saved originals carry the wW136 prefix).

   A pet is a step stronger (engine/pets.js: PET.ctx, petCtx) for each thing about a match that suits it: one of its
   sports, one of its moons, its own ground, and the other side's element when its own beats it (PET_BEATS: ember
   beats bloom, bloom tide, tide ember; aether and rime beat each other). The engine knows the sport and the sky; the
   Realm tells it the ground and the foe: at kickoff, RUN.pet gets here and foe, the element of the match's region
   (W_PET_REGION_EL: the plains are aether), since a region's teams play in its element.
   The Pets tab says each pet's sports and moons, and what beats what; How to play explains.

   W_PET_REGION_EL
   Wrapped: wKickoff (wW136Kickoff: here and foe), wPetCard (wW136PetCard: sports and moons), renderHelp
   (wW136RenderHelp: #wHelpPetCtx). */

const W_PET_REGION_EL = { plains: 'aether', bloom: 'bloom', tide: 'tide', ember: 'ember', rime: 'rime' };
const wW136Kickoff = wKickoff;
wKickoff = function (enc) {
  // (the pet at your side learns where it is playing, and whom: the region's element, for both)
  if (RUN && RUN.pet && enc && enc.world) { const el = W_PET_REGION_EL[enc.world.region] || null; RUN.pet.here = el; RUN.pet.foe = el; }
  return wW136Kickoff.apply(this, arguments);
};
const wW136PetCard = wPetCard;
wPetCard = function (q, side) {
  const D = PETS[q.kind], sp = (D.sports || []).map(s => SPORTS[s] ? SPORTS[s].n : s), mo = (D.moon || []).map(i => MOON[i] ? MOON[i].n : '');
  const line = `<small class="wnst wpetctx">Stronger in ${sp.length ? esc(sp.join(' and ')) : 'no sport in particular'}${mo.length ? `, under a ${esc(mo.join(' or '))}` : ''}, at home in its own region, and against ${esc(DB.elems.names[PET_BEATS[D.el]] || PET_BEATS[D.el])} teams.</small>`;
  return wW136PetCard(q, side).replace('<small class="hint">', line + '<small class="hint">');
};
const wW136RenderHelp = renderHelp;
renderHelp = function () {
  wW136RenderHelp();
  const h = $('wHelpPetBond') || $('wHelpPets'); if (!h || $('wHelpPetCtx')) return;
  const n = Math.round(PET.ctx * 100);
  h.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpPetCtx"><b>Pets in context.</b> A pet is ${n}% stronger for each thing about a match that suits it: one of its sports, one of its moons, its own region (its element's), and teams of an element its own beats (ember beats bloom, bloom beats tide, tide beats ember; aether and rime beat each other). A region's teams play in its element. The Pets tab says what suits each pet.</p>`);
};
