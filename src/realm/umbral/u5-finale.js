/* u5: the finale (issue #99, phase 5). Loads after the sports' parts (u4a..u4h); changes earlier parts only by
   reassignment (saved originals carry the wWU5 prefix).

   Forging the Seal. Hollow Aurelia waits in the Hollow Coliseum (DB.chars.nadir_aurelia). With all nine pieces, PLAY
   is the finale against Nadir Athletic: three rounds, each in a different way to play, the three where your Umbral
   record is weakest (the champions that took you the most tries; chosen once, WG.umbral.finaleSports). Each round is
   that sport's game at tier U (its adapter, as its champion's was) or, for the card game, an Umbral card match; it
   draws W_UMB5.hexes hexes, one fewer where you won that sport's piece at the first try (the piece's edge: win them
   well). Win a round and the next waits (WG.umbral.finale: rounds won); lose and you try that round again. In a
   Hardcore journey a lost round ends the journey, as any loss does.
   Win the third, and the Seal is forged: the pieces lock together, the portal closes, the eclipse lifts, and you are
   back in the Crown Coliseum, in daylight (WG.umbral.sealed, the year in sealedYear). Phase 6 hangs the rewards on it.

   W_UMB5, wUmbFinale, wUmbFinaleEntry, wUmbFinaleSports, wUmbSeal, wUmbSealScene
   Once sealed, the portal is gone (u0's wUmbOpen), and so are the herald, the eclipses and the dreams (u1).
   Wraps: W_ON_END.nadir (wWU5OnNadir: a finale round's end), wNextPrompt (wWU5NextPrompt: the closing scene once the
   world is free, WG.umbral.sealScene), wRunAct (wWU5RunAct: PLAY), buildAllMaps
   (wWU5BuildAllMaps: Aurelia in the Hollow Coliseum), wAudit (wWU5Audit: she is placed, and every piece has its sport). */

const W_UMB5 = {
  rounds: 3, hexes: 2,
  // a piece's way to play: an engine (W_ENGINES key), or the card game (null)
  engine: { card: null, baseball: 'diamond', basketball: 'court', golf: 'links', bowling: 'lanes', curling: 'shed', football: 'gridiron', boxing: 'ring', hockey: 'rink' },
  card: { ids: ['u_aurelia', 'u_gatekeeper'], type: 'boss' },
};
EN('u_aurelia', 'Hollow Aurelia', 'wraith', [210, 220], {
  crown: { n: 'The Last Game', ops: [['a', 9, 2], ['p', 'weak', 1]] },
  hold: { n: 'Never Left', ops: [['b', 20], ['s', 'str', 3]] },
  echo: { n: 'Echo of the Crowd', ops: [['a', 16], ['add', 'u_shade', 1, 'draw']] },
  lose: { n: 'The Losing Throw', ops: [['a', 6, 4]] },
}, { seq: ['hold', 'crown', 'echo', 'lose'] }, { team: { name: 'Nadir Athletic', short: 'NDR', color: '#2a1e34', light: '#e4defa' }, aura: 'wisps', crown: 1, flav: 'Captain of Apex Athletic, once. She never left the last game she lost, and she has been playing it ever since.' });
DB.chars.nadir_aurelia = { name: 'Hollow Aurelia', kind: 'wraith', look: { coat: '#2a1e34', acc: 'scarf', tall: 1 },
  greet: 'You have been busy. Bring me all nine PIECES and we will play for the SEAL. Three games. My choice.',
  topics: {
    job: { t: 'I captain Nadir Athletic. I lost a game once. I am still playing it.' },
    pieces: { t: 'Nine. One for every way to play. Without all of them there is nothing to forge, and nothing to play for.' },
    seal: { t: 'Win three games against my side and the pieces lock together. The door shuts, and you go home. Lose, and you come back and try that game again. I will be here. I am always here.' },
    games: { t: 'I choose them. The three you are worst at, by your record on this side. A piece you won cleanly, at the first try, makes its game a little kinder.' },
    play: { t: 'Then let us begin.', act: 'ufinale' },
  } };

/* ---------- the finale ---------- */
// the champion who held a piece (not the finale's own entries)
// (a round of the Seal holds no piece: an adapter's card that names the piece reads this instead of failing)
Object.defineProperty(W_UMB_PIECES, 'null', { value: { n: 'a round of the Seal', sport: 'the Seal' }, enumerable: false });
const wUmbChampOf = piece => Object.keys(W_NADIR).find(k => W_NADIR[k].piece === piece && !('finale' in W_NADIR[k])) || null;
// the three ways to play where your record is weakest: the most tries taken; ties in the pieces' own order
function wUmbFinaleSports() {
  const U = wUmb(); if (!U) return [];
  if (U.finaleSports && U.finaleSports.length === W_UMB5.rounds) return U.finaleSports;
  const ps = Object.keys(W_UMB_PIECES), tries = p => { const c = wUmbChampOf(p); return (c && U.tries[c]) || 0; };
  U.finaleSports = ps.map((p, i) => [p, tries(p), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, W_UMB5.rounds).map(x => x[0]);
  return U.finaleSports;
}
// a piece won at the first try (held, and its champion never beat you): its round draws one hex fewer
const wUmbClean = piece => { const U = wUmb(), c = wUmbChampOf(piece); return !!(U && c && U.pieces.includes(piece) && !U.tries[c]); };
// the round being played, as a champion's entry (W_NADIR.finale): made from WG.umbral, so a reload mid-round finds it
function wUmbFinaleEntry() {
  const U = wUmb(); if (!U) return null;
  const r = Math.min(U.finale || 0, W_UMB5.rounds - 1), piece = wUmbFinaleSports()[r], eng = W_UMB5.engine[piece];
  // (an engine round is that sport's champion's game, their side and all, with Aurelia's name on it: no ground, no
  // piece, no toll)
  const base = eng ? W_NADIR[wUmbChampOf(piece)] || {} : {};
  // (Aurelia plays a sport's round through its champion, who takes the field under her: their name on its card)
  const C = Object.assign({}, base, { piece: null, finale: r, char: base.char || 'nadir_aurelia', region: base.region || 'plains', engine: eng, hexes: W_UMB5.hexes - (wUmbClean(piece) ? 1 : 0), toll: 0, gold: 0 },
    eng ? {} : { ids: W_UMB5.card.ids.slice(), type: W_UMB5.card.type });
  delete C.ground; delete C.map; delete C.cond;
  return W_NADIR.finale = C;
}
function wUmbFinale() {
  const U = wUmb(); if (!U) return 'Nobody here plays.';
  if (U.sealed) return 'The Seal is forged. Hollow Aurelia is gone, and the stands are empty.';
  const missing = Object.keys(W_UMB_PIECES).filter(p => !U.pieces.includes(p));
  if (missing.length) return `You hold ${U.pieces.length} of the nine pieces. Hollow Aurelia will not play for the Seal until you hold them all (still out: ${missing.map(p => W_UMB_PIECES[p].n).join(', ')}).`;
  const r = U.finale || 0, piece = wUmbFinaleSports()[r];
  wUmbFinaleEntry();
  wLog(`The Seal, round ${r + 1} of ${W_UMB5.rounds}: ${W_UMB_PIECES[piece].sport}.${wUmbClean(piece) ? ` (You won ${W_UMB_PIECES[piece].n} cleanly: one hex fewer.)` : ''}`, 'b');
  return wNadirMatch('finale');
}
const wWU5OnNadir = W_ON_END.nadir;
W_ON_END.nadir = function (r, ref) {
  if (ref && ref.id === 'finale' && !W_NADIR.finale) wUmbFinaleEntry();
  const C = ref && W_NADIR[ref.id], U = wUmb();
  if (!C || !('finale' in C) || !U) return wWU5OnNadir.apply(this, arguments);
  if (r === 'win') {
    U.finale = (U.finale || 0) + 1;
    if (U.finale >= W_UMB5.rounds) { wUmbSeal(); return; }
    wLog(`You take round ${U.finale} of ${W_UMB5.rounds}. Hollow Aurelia does not move. "Again," she says.`, 'g');
  } else {
    U.tries.finale = (U.tries.finale || 0) + 1;
    wLog(`Round ${(U.finale || 0) + 1} goes to Nadir Athletic. The Seal waits; so does she.`, 'b');
    // (a Hardcore journey ends on a lost round, as on any loss; a card round's loss is ended by the match itself)
    if (WG.hardcore && C.engine && !LAB) { recordRun('lose'); showEnd('lose'); return; }
  }
  wSave();
};
function wUmbSeal() {
  const U = wUmb(); U.sealed = WG.dayAbs; U.sealedYear = WG.year; U.finale = W_UMB5.rounds;
  wLog(`The Seal is forged. The nine pieces lock together in your captain's hands, the portal at the end of the Road to Nowhere closes, and the eclipse lifts. Year ${WG.year}.`, 'g');
  wUmbHeraldSync(); // (the herald has nothing more to say: he goes)
  const m = MAPS.coliseum; wEnterMap('coliseum', m.spawn[0], m.spawn[1]); WG.face = 'u';
  wInvalidate('umbralden'); wSave();
  // (the scene waits till the world is free: a sport's own result card closes first, and a recruit's question after)
  if (!LAB) U.sealScene = 1;
}
function wUmbSealScene() {
  const close = modal(`<header><h3>The Seal of the Crown</h3></header>
    <div class="wumblines"><p class="wumbn">The last whistle goes, and the Hollow Coliseum goes very quiet.</p>
    <p class="wumbn">Nine pieces, from nine games, lock together in your captain's hands: a seal, warm, and heavier than it looks.</p>
    <p class="wumbh">Hollow Aurelia looks at it for a long time. "That was a good game," she says, and she is gone.</p>
    <p class="wumbn">The stands empty like a breath going out. Far to the north, at the end of the Road to Nowhere, the portal folds shut.</p>
    <p class="wumbn">You walk out into the Crown Coliseum at noon. The sun is out. The block beside the statue is white again, and somebody has carved your team's name in it.</p></div>
    <div class="row"><button class="btn" id="wUmbSealed">Home, then</button></div>`, () => { WUI.hudKey = ''; wDrain(); });
  $('wUmbSealed').onclick = () => close();
}
const wWU5NextPrompt = wNextPrompt;
wNextPrompt = function () {
  const U = wUmb();
  if (U && U.sealScene && !LAB && wActive()) { U.sealScene = 0; wSave(); wUmbSealScene(); return true; }
  return wWU5NextPrompt.apply(this, arguments);
};
const wWU5RunAct = wRunAct;
wRunAct = function (act, id) {
  if (act === 'ufinale') { WUI.held = null; if (WUI.talk) wCloseTalk(); const why = wUmbFinale(); if (why) wLog(why, 'b'); return; }
  return wWU5RunAct.apply(this, arguments);
};
// (once sealed, the portal is gone: u0's wUmbOpen)
// Aurelia in the Hollow Coliseum, by the statue's mirror
const wWU5BuildAllMaps = buildAllMaps;
buildAllMaps = function () {
  const r = wWU5BuildAllMaps.apply(this, arguments), m = MAPS['u:coliseum'];
  if (m && !m.npcs.some(n => n.id === 'nadir_aurelia')) {
    let g = null; for (let y = 0; y < m.h && !g; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === 'G') { g = [x, y]; break; }
    const free = (x, y) => { const c = m.t[y] && m.t[y][x], td = c && DB.tiles[c]; return td && td.walk && !td.enter && !m.npcs.some(n => n.x === x && n.y === y); };
    let at = null; if (g) for (let rr = 1; !at && rr < 5; rr++) for (let dy = -rr; dy <= rr && !at; dy++) for (let dx = -rr; dx <= rr && !at; dx++) if (free(g[0] + dx, g[1] + dy)) at = [g[0] + dx, g[1] + dy];
    if (at) m.npcs.push({ id: 'nadir_aurelia', x: at[0], y: at[1], fixed: true });
  }
  return r;
};
const wWU5Audit = wAudit;
wAudit = function () {
  const P = wWU5Audit.apply(this, arguments).filter(s => s !== 'character nadir_aurelia is never placed on a map' && !/champion finale\b/.test(s));
  const m = MAPS['u:coliseum']; if (m && !m.npcs.some(n => n.id === 'nadir_aurelia')) P.push('Hollow Aurelia has nowhere to stand in the Hollow Coliseum');
  for (const p in W_UMB_PIECES) if (!(p in W_UMB5.engine)) P.push('the piece ' + p + ' has no way to play in the finale');
  return P;
};
