/* w138: the feel of pets (issue #104, phase 9). Loads after w112-quickstart.js (it adds a Quick start tab); changes earlier parts only by
   reassignment (saved originals carry the wW138 prefix).

   Sound, from Sudden Death's own tone and noise, following your Sound effects setting: a pet joining (a rising
   chirp), an egg cracking (two taps and a chirp), a bond level reached (a chime), a treat given (a crunch). What a pet
   does in a match already chirps (the 'pet' fx in ui/fight/scene.js).
   Tips: TIPS.w_pet with your first pet (the Pets tab, the trick's key), TIPS.w_petegg with your first pet egg (where
   it hatches), TIPS.w_pethungry the first time a pet goes hungry (feed it, or a treat).
   Medals, on SD's ACH: pets of different kinds owned (realmPetKinds, a set), a full kennel (realmKennelFull), pets
   that reach bond 3 (realmPetBond3), hatching places used (realmHatchPlaces, a set) and tricks thrown in matches
   (realmPetTricks).
   The Quick start: a Pets tab (W_QUICK, w112), three steps with screenshots from test/realm_quick_shots.py: the Pets
   tab, a match with your pet and a rival's on the field, a hatching.

   wPetSound(k)
   Wraps: wPetJoined (wW138PetJoined: the chirp, the kinds and the full kennel, however a pet joins), wPeggHatch (wW138PeggHatch: the crack, the
   places), wPetBondXp (wW138PetBondXp: the chime, bond 3), wPetTreat (wW138PetTreat: the crunch), petTrick
   (wW138PetTrick: tricks thrown), wPetUpkeep (wW138PetUpkeep: the hungry tip). */

function wPetSound(k) {
  if (LAB || !SET.sfx) return;
  try {
    if (k === 'join') { tone(660, .08, 'sine', .05, 300); tone(990, .12, 'sine', .04, 200, .08); }
    else if (k === 'crack') { noise(.04, .25, 2600, 3); noise(.04, .25, 2900, 3, .12); tone(1100, .15, 'sine', .05, 500, .26); }
    else if (k === 'bond') { tone(784, .18, 'sine', .05, 0); tone(1046, .25, 'sine', .05, 0, .12); tone(1318, .35, 'sine', .04, 0, .24); }
    else if (k === 'treat') { noise(.05, .3, 1800, 2); noise(.05, .25, 1500, 2, .08); }
  } catch (e) { console.error(e); }
}
// (a pet joins, however it came: a welcome chirp, unless it was had back or hatched with its own; the medals)
const wW138PetJoined = wPetJoined;
wPetJoined = function (q, how) {
  wW138PetJoined.apply(this, arguments);
  if (LAB || !q) return;
  if (!(how && (how.back || how.quiet))) wPetSound('join');
  achSet('realmPetKinds', q.kind);
  if (wPets().owned.length >= W_PET.kennel && !wFlag('kennel_full')) { wSetFlag('kennel_full'); achAdd('realmKennelFull', 1); }
};
const wW138PeggHatch = wPeggHatch;
wPeggHatch = function (el) { const q = wW138PeggHatch.apply(this, arguments); if (q && !LAB) { wPetSound('crack'); achSet('realmHatchPlaces', el); } return q; };
const wW138PetBondXp = wPetBondXp;
wPetBondXp = function (q) {
  const up = wW138PetBondXp.apply(this, arguments);
  if (up && !LAB) { wPetSound('bond'); if (q && q.bond >= 3) achAdd('realmPetBond3', 1); }
  return up;
};
const wW138PetTreat = wPetTreat;
wPetTreat = function () { const why = wW138PetTreat.apply(this, arguments); if (!why) wPetSound('treat'); return why; };
// (a trick thrown in a match from the world: petTrick says false when it couldn't be)
const wW138PetTrick = petTrick;
petTrick = function () { const r = wW138PetTrick.apply(this, arguments); if (r !== false && WG && !LAB) achAdd('realmPetTricks', 1); return r; };
const wW138PetUpkeep = wPetUpkeep;
// (noted as the week turns; shown by wPetTips once you are on the map)
wPetUpkeep = function () { const r = wW138PetUpkeep.apply(this, arguments); if (!LAB && wPets().owned.some(q => q.hungry)) WG.petHungryTip = 1; return r; };

Object.assign(TIPS, {
  w_pet: ['Your pet', 'Your pet fights beside you in card matches. The Pets tab on the Team screen (C) shows what it does and which one goes with you. In a match, its trick is the button by its name, or T, once a match.'],
  w_petegg: ['A pet egg', 'A pet egg hatches at one place, by its element: Graftonbury\'s glasshouse, the Mossgate spring, Saltmere\'s rock pool, the Cinderhold forge or the Rimewatch ice-house. Put it in; it hatches in three days.'],
  w_pethungry: ['A hungry pet', 'A pet\'s upkeep went unpaid, so it is hungry: its numbers are halved and its bond won\'t grow. Feed it on the Pets tab, or give it a treat (its favourite, or a pet biscuit).'],
});
function wPetTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  if (WG.pets && WG.pets.owned.length) tip('w_pet');
  if (WG.petHungryTip) { delete WG.petHungryTip; tip('w_pethungry'); }
  if (typeof W_PEGG !== 'undefined' && Object.keys(W_PEGG.eggs).some(k => wHas(wPeggItem(k)))) tip('w_petegg');
}
setInterval(wPetTips, 900);

ACH.push(
  { id: 'w_petkinds', n: 'Menagerie', d: 'Own pets of different kinds', stat: 'realmPetKinds', set: true, at: [1, 6, 15] },
  { id: 'w_kennel', n: 'A Full Kennel', d: 'Fill your kennel', stat: 'realmKennelFull', at: [1, 3, 10] },
  { id: 'w_bond3', n: 'Inseparable', d: 'Raise a pet\'s bond to 3', stat: 'realmPetBond3', at: [1, 4, 12] },
  { id: 'w_hatch', n: 'Warm Hands', d: 'Hatch pet eggs at different hatching places', stat: 'realmHatchPlaces', set: true, at: [1, 3, 5] },
  { id: 'w_tricks', n: 'Good Pet', d: 'Throw your pet\'s trick in matches', stat: 'realmPetTricks', at: [5, 50, 250] },
);

// the Quick start: a Pets tab (after the sports)
W_QUICK.push({ id: 'pets', n: 'Pets', where: 'your camp', more: 'wHelpPets',
  lede: 'A pet fights beside your team in card matches. You can own several; one goes with you.',
  steps: [
    { img: 'pets-tab', h: 'Pick the one at your side', t: 'Open the Team screen (C) and the Pets tab. At my side sends a pet into your matches; the rest wait in the kennel. Each card says what it does now and what opens as its bond grows, and what it likes to eat.' },
    { img: 'pets-field', h: 'In a match, it helps on its own', t: 'Your pet stands in front of your team and acts when its moment comes. Hover its name above your cards to see what it does. Once a match, its trick is yours to use: the button by its name, or T. A rival club brings a pet of its own.' },
    { img: 'pets-hatch', h: 'More pets: eggs, shops and keepers', t: 'Eggs turn up in the alphas\' rooms and quiet corners, and each hatches at one place by its element. Three towns have pet shops, opened by a small favour, and two have keepers with a pet found nowhere else.' },
  ],
  tip: 'Every pet costs its upkeep each week. A hungry one is weaker: feed it, or give it a treat.',
  keys: [['C', 'the Team screen (the Pets tab)'], ['T', 'your pet\'s trick, in a match'], ['Hover', 'its name in a match: what it does now']],
  phone: 'On a phone, tap the trick button by your pet\'s name.',
  foot: 'That\'s all you need to start. Everything else, bond, treats, eggs, shops and what suits each pet, is further down: <a href="#" data-wqmore="wHelpPets">Pets: how it works</a>.' });
