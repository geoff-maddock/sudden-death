/* w158: the feel of jousting (issue #117, phase 13), as w130 is curling's. Sound at the Lists, the Lists' own music,
   tips, medals and the Quick start.

   Sound. Built from Sudden Death's own tone and noise (src/app/sound.js), following your Sound effects setting, only
   while the Lists are on screen, from the page's beats (wJT.onPhase), a short beat of our own while the riders charge
   (wListsHoofBeat, on a timer), and the end (wJT.onOver):
   - the charge: hoofbeats on the stride's beat (a canter's slower, a gallop's quicker), louder as the riders close; on
     You ride a tick for a spur on the beat, a dull note for one off it, and a clunk as your lance comes down;
   - the impact: the crack of a lance broken, bigger with a ring of steel on a helm break, a thin tink for a glance;
     heard as the lances meet (in your balance moment, from the view's hits), once a course; an unhorsing's thud;
   - the herald's trumpet: a short call at the first course of each heat and of the tilt for the crown;
   - the gallery: a cheer when the first side on the board scores (louder for a helm break, loudest for an unhorsing),
     a groan when only the other side does; the match's own last course is the end's;
   - the end of a match: a match from the world, and an exhibition you ride, by the result (the full fanfare and the
     gallery for a win, a low note and a groan for a loss); an exhibition you only watch, the fanfare and the gallery.
   The tilting yard (practice at the straw targets) has the hoofbeats and the cracks, and no trumpet or gallery.
   Music. The Lists' own theme (w26's g_lists, "Fanfare at the Lists") plays on the Lists view: calm between matches,
   fight in a match, hype in the tilt for the crown. The Umbral's Hollow Lists (a match with the Lich or its hexes)
   keeps whatever played before.
   Tips. TIPS.w_lists once your team can joust (W_JTG.minOwn players), TIPS.w_lance once you have won a jousting match,
   TIPS.w_listsride the first time you ride a course of your own.
   Medals, on SD's ACH, from matches from the world (exhibitions and the yard don't count; a conceded one doesn't):
   jousting matches won (realmListsWins), Gilded Lances (realmLances), riders unhorsed by yours (realmUnhorsings),
   lances broken on the helm (realmHelmBreaks), and a heat in which the other side scored nothing (realmCleanHeats,
   from the tourney board: no course of theirs above 0; a foul of theirs, -1, isn't a point against you).
   The Quick start: jousting's six steps are w112's (the plan, the spur, the couch, the aim, the seat, between courses;
   the screenshots from test/realm_quick_shots.py lists), with its button beside How to play under the lists.
   On a phone a squire's name stays with their job buttons (.wjtsq doesn't break).
   wListsHoofBeat() one beat of the charge's sound (the timer's), wListsCrack(k) a lance meeting ({ broke, zone, at }),
   wListsTrumpet(big) the herald's call
   Wraps: wJT.onPhase (wW158OnPhase: the sounds), wJT.onOver (wW158OnOver: the end), musicWanted (wW158MusicWanted),
   wListsSettle (wW158ListsSettle: the medals), wLanceWon (wW158LanceWon), renderHelp (wW158RenderHelp: #wHelpListsFeel
   after #wHelpListsCup). */

const wListsSoundOn = () => !LAB && SET.sfx !== false && UI.view === 'lists' && !!wJT.G && !!wJT.G.teams;
const W_LISTS_SND = { beat: 40, hoof: [150, .12, .16], crack: [2400, .42], helm: [1900, .6], ring: 1250, groan: [520, .12] };
// (g: the match these belong to; n: the course whose hoofbeats are heard, with its beat and your taps so far; crack: the
// course whose lances were heard; heat: the heat (or the tilt) whose trumpet was heard)
const WJTS = { g: null, n: -1, hoof: -1, hits: 0, bad: 0, down: false, crack: -1, heat: '' };
function wListsSndMatch() { const G = wJT.G; if (WJTS.g !== G) Object.assign(WJTS, { g: G, n: -1, hoof: -1, hits: 0, bad: 0, down: false, crack: -1, heat: '' }); return G; }
// the charge: a hoofbeat a stride, and your spur's taps and couch
function wListsHoofBeat() {
  if (!wListsSoundOn() || wJT.paused || wJT.phase !== 'charge') return;
  const V = wJT.view, C = V && V.charge; if (!C) return;
  const G = wListsSndMatch(), R = wJT.playRules, H = W_LISTS_SND.hoof;
  if (WJTS.n !== G.n) Object.assign(WJTS, { n: G.n, hoof: -1, hits: 0, bad: 0, down: false });
  const b = R.spur.beat[C.pace] || R.spur.beat.canter, k = Math.floor(C.p * R.charge / b);
  // (both horses: a thud and its echo a third of a stride on; louder as the gap closes)
  if (k > WJTS.hoof) { WJTS.hoof = k; const v = H[1] + H[2] * C.p; noise(.07, v, H[0], 1.1); tone(70, .08, 'sine', .04 + .04 * C.p, -20); noise(.05, v * .7, H[0] + 40, 1.1, b * .32); }
  if (C.mine) {
    if (C.hits > WJTS.hits) tone(880, .05, 'triangle', .05);
    if (C.bad > WJTS.bad) tone(180, .08, 'square', .04, -40);
    if (C.down && !WJTS.down) noise(.08, .16, 600, 2);
    Object.assign(WJTS, { hits: C.hits, bad: C.bad, down: !!C.down });
  }
}
setInterval(wListsHoofBeat, W_LISTS_SND.beat);
// a lance meeting its mark: the crack of a break (a helm break's bigger, with a ring of steel), a glance's tink
function wListsCrack(k) {
  if (!k) return;
  if (k.broke) {
    const helm = k.zone === 'helm', C = helm ? W_LISTS_SND.helm : W_LISTS_SND.crack;
    noise(helm ? .22 : .14, C[1], C[0], 1.4); noise(helm ? .5 : .32, .2, 900, .7, .03, -300); tone(helm ? 110 : 150, .12, 'square', .06, -60);
    if (helm) tone(W_LISTS_SND.ring, .35, 'triangle', .05, -200, .02);
  } else if (k.at === 'glance') tone(1800, .07, 'triangle', .04, -300);
}
// the herald's trumpet: a short call, or the full fanfare (a win)
function wListsTrumpet(big) {
  const N = big ? [[392, .1], [392, .1], [523, .1], [659, .14], [784, .45]] : [[523, .12], [659, .12], [784, .32]];
  let t = 0; for (const [f, d] of N) { tone(f, d, 'sawtooth', .04, 0, t); tone(f * 2, d, 'square', .012, 0, t); t += d + .03; }
}
const wListsGroan = () => { noise(.9, W_LISTS_SND.groan[1], W_LISTS_SND.groan[0], .6, 0, -250); tone(220, .6, 'triangle', .04, -60); };
const wW158OnPhase = wJT.onPhase;
wJT.onPhase = ph => {
  if (wW158OnPhase) wW158OnPhase(ph);
  try {
    if (!wListsSoundOn()) return;
    const G = wListsSndMatch(), V = wJT.view; if (!V) return;
    // the lances meet: in your balance moment the course is still open (G.n is this course); after it, it's closed
    if (ph === 'seat' && V.hits && WJTS.crack !== G.n) { WJTS.crack = G.n; V.hits.forEach(wListsCrack); }
    if (ph === 'after') {
      const L = wJT.last; if (!L || !L.res) return;
      if (WJTS.crack !== G.n - 1) { WJTS.crack = G.n - 1; [0, 1].forEach(s => wListsCrack({ broke: L.broke && L.broke[s], zone: L.zone[s], at: L.res[s].at })); }
      const un = [0, 1].filter(s => L.res[s].unhorse);
      if (un.length) { noise(.35, .5, 110, .7, .12); tone(55, .3, 'sine', .1, -15, .12); }
      if (G.yard || G.over) return;
      const me = V.you, p = L.pts || [0, 0];
      if (p[me] > 0) sfx.crowd(1 + (L.zone[me] === 'helm' ? .6 : 0) + (L.res[me].unhorse ? 1 : 0));
      else if (p[1 - me] > 0) wListsGroan();
    }
    // the herald's trumpet at the first course of a heat, and of the tilt for the crown
    if ((ph === 'plan' || ph === 'herald') && !G.yard && G.course === 0) {
      const key = V.inTilt ? 'tilt' : String(G.heat);
      if (WJTS.heat !== key) { WJTS.heat = key; wListsTrumpet(false); }
    }
  } catch (e) { console.error(e); }
};
const wW158OnOver = wJT.onOver;
wJT.onOver = s => {
  if (wW158OnOver) wW158OnOver(s);
  try {
    if (!wListsSoundOn() || !s || wJT.G.yard) return;
    // (a match from the world sounds by its result, however you followed it; an exhibition you watch ends on the
    // fanfare and the gallery, one you ride by its result)
    if (!(WJT && WJT.world) && wJT.mode === 'watch') { wListsTrumpet(true); sfx.crowd(1.4); return; }
    const win = s.win != null ? s.win : s.over ? s.over.win : -1;
    if (win === (wJT.view ? wJT.view.you : 0)) { wListsTrumpet(true); sfx.crowd(WJT && WJT.world ? 2 : 1.4); } else { sfx.bad(); wListsGroan(); }
  } catch (e) { console.error(e); }
};

/* ---------- music: the Lists' own theme on the Lists view ---------- */
const wW158MusicWanted = musicWanted;
musicWanted = function () {
  const base = wW158MusicWanted();
  if (!WG || !RUN || UI.screen !== 'run' || UI.view !== 'lists' || !THEMES.wg_g_lists) return base;
  const G = wJT.G; if (G && (G.lich || G.hex)) return base;
  const live = !!(G && G.teams && !G.over && !G.yard && WJT && !WJT.over), out = ['wg_g_lists', !live ? 'calm' : wJT.inTilt() ? 'hype' : 'fight'];
  MUS.want = out[0];
  return out;
};

/* ---------- tips ---------- */
Object.assign(TIPS, {
  w_lists: ['Jousting', 'Your team is big enough for jousting. On the Team screen (C), the Lists tab picks your two riders, two squires and their mounts, and Joust a match plays a club. Sir Ruddock at the Tilting Lists books a MATCH too.'],
  w_lance: ['The Gilded Lance', 'Jousting has its own cup, every week. Ask Sir Ruddock at the Tilting Lists about the CUP, or use the Gilded Lance button on the Lists tab.'],
  w_listsride: ['Riding a course', 'Press Space to ride your squire\'s plan, then tap Space with the hoofbeats, hold it at the green couch mark, and steer the white dot onto your mark with the arrows. Rocked? Lean against the needle. Quick start shows each step.'],
});
function wListsTips() {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run') return;
  if (UI.view === 'lists') { if (wJT.mode === 'play' && wJT.phase === 'plan' && wJT.G && !wJT.G.yard) tip('w_listsride'); return; }
  if (UI.view !== 'world') return;
  if (wRoster().length >= W_JTG.minOwn) tip('w_lists');
  if (WG.jtg && WG.jtg.w > 0) tip('w_lance');
}
setInterval(wListsTips, 700);

/* ---------- medals ---------- */
ACH.push(
  { id: 'w_lists', n: 'Lance and Pennant', d: 'Win jousting matches at the Tilting Lists', stat: 'realmListsWins', at: [1, 10, 30] },
  { id: 'w_lance', n: 'Gilded', d: 'Win the Gilded Lance', stat: 'realmLances', at: [1, 3, 8] },
  { id: 'w_unhorse', n: 'Into the Sand', d: 'Unhorse a rider in a jousting match', stat: 'realmUnhorsings', at: [1, 10, 40] },
  { id: 'w_helmbreak', n: 'Crack the Crest', d: 'Break a lance on the helm in a jousting match', stat: 'realmHelmBreaks', at: [1, 10, 50] },
  { id: 'w_cleanheat', n: 'Untouched', d: 'Ride a jousting heat without a point against', stat: 'realmCleanHeats', at: [1, 5, 20] },
);
// a heat the other side scored nothing in: one of yours ridden, and no course of theirs above 0
const wListsCleanHeats = sc => [0, 1].filter(h => ((sc[0] || [])[h] || []).some(v => v != null) && !((sc[1] || [])[h] || []).some(v => v > 0)).length;
const wW158ListsSettle = wListsSettle;
wListsSettle = function (sum) {
  const S = sum || {}, m = wW158ListsSettle.apply(this, arguments);
  if (LAB || S.text === 'conceded') return m;
  const win = (S.win != null ? S.win : S.over ? S.over.win : -1) === 0, st = (S.st || [])[0] || {};
  if (win) achAdd('realmListsWins', 1);
  if (st.unhorse) achAdd('realmUnhorsings', st.unhorse);
  if (st.helms) achAdd('realmHelmBreaks', st.helms);
  const clean = wListsCleanHeats((S.board && S.board.sc) || []); if (clean) achAdd('realmCleanHeats', clean);
  return m;
};
const wW158LanceWon = wLanceWon;
wLanceWon = function () { wW158LanceWon(); if (!LAB) achAdd('realmLances', 1); };

document.head.insertAdjacentHTML('beforeend', '<style>#wListsSq .wjtsq { display: inline-block; white-space: nowrap; margin: 0 6px 4px 0; }</style>');

const wW158RenderHelp = renderHelp;
renderHelp = function () {
  wW158RenderHelp();
  const d = $('wHelpListsCup'); if (!d || $('wHelpListsFeel')) return;
  d.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpListsFeel"><b>At the Lists</b> you hear the hoofbeats of the charge (a tick when you spur on the beat), the crack of a lance broken (a ring of steel on a helm break) and the thud of an unhorsing. The herald's trumpet opens each heat and the tilt for the crown, and the gallery cheers your points and groans at theirs. The Lists have their own music. Medals: jousting matches won, Gilded Lances, riders unhorsed, lances broken on the helm, and a heat without a point against.</p>`);
};
