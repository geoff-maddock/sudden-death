/* the end of the wGF scope: what the Realm may call. Phase 0 has the rules only; the seam's start, sim, box, show,
   hide, pause, audio and onOver/onQuit/onSnap come with the field (phase 1), when it joins W_ENGINES (w19b). */
return { newGame: gfNewGame, spot: gfSpot, get G() { return G; }, rules: Object.assign({}, GF_RULES) };
