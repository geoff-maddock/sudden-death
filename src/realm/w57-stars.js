/* w57: superstars, phase 1 (issue #24): the plumbing. Six one-of-a-kind monsters, each a kind of its own that no club
   and no tavern has, unlocked by a feat and kept on the profile across journeys, like the Hall of Legends (w35).
   This part keeps the unlocks and watches for the feats; the superstars themselves (their bodies, cards and powers in
   every engine, the meeting and the signing) come in later phases. Settled on the issue: new kinds, kept across
   journeys, six of them, one a journey, and they join at your team's average level.

   The feats:
     Phoenix     win the Cinder Cup (wGcupWon)
     Kraken      win the Rimewatch cup (wCupWon('rime'))
     Behemoth    beat three legends, over any number of journeys (W_ON_END.legend)
     Djinn       walk the Road to Nowhere to its end (the flag rare_umbralden)
     Hydra       hatch all five rare eggs, over any number of journeys (wHatchEgg)
     Frost Wyrm  win the Crown (wCupWon('crown'))
   A feat done in a journey from before this part counts when that journey is next played (wStarsCheck reads what the
   journey already holds), and a Crown on the profile counts from the Hall of Legends.

   Storage: pkey('sd-realm-stars') = { un: { id: 'YYYY-MM-DD' }, legs: { '<journey>:<legend>': 1 }, eggs: { mapId: 1 },
   seen: [ids shown on the Stars tab] }. WG.starJ is this journey's key (plain data). Nothing is stored in LAB.
   W_STARS, wStarsAll(), wStarOn(id), wStarsCheck(), wStarProgress(id)
   The Team screen gets a Stars tab: every superstar, a silhouette and their feat until unlocked.
   Wraps: wStart (wW57Start), wCupWon (wW57CupWon), wGcupWon (wW57GcupWon), wSetFlag (wW57SetFlag), wHatchEgg
   (wW57HatchEgg), W_ON_END.legend (wW57OnLegend), wOpenCamp and wRenderCamp (wW57OpenCamp, wW57RenderCamp: the
   Stars tab), renderHelp (wW57RenderHelp: #wHelpStars). Also a medal (w_stars, Star Finder: realmStars). */

const W_STARS = [
  { id: 'phoenix', n: 'Phoenix', el: 'ember', plays: 'Fast and fragile, and hard to keep down.', pow: 'Rebirth', powd: 'Once a match, back from 0 HP.',
    feat: 'Win the Cinder Cup.' },
  { id: 'kraken', n: 'Kraken', el: 'tide', plays: 'Huge reach, slow to turn.', pow: 'Eight Arms', powd: 'Hits or catches from far away.',
    feat: 'Win the Rimewatch cup.' },
  { id: 'behemoth', n: 'Behemoth', el: 'bloom', plays: 'A wall that moves.', pow: 'Earthquake', powd: 'Knocks everyone down.',
    feat: 'Beat three legends from the Hall of Legends, over any number of journeys.', need: 3 },
  { id: 'djinn', n: 'Djinn', el: 'aether', plays: 'Tricky, all guile.', pow: 'Three Wishes', powd: 'Picks one of three effects.',
    feat: 'Walk the Road to Nowhere to its end, after dark.' },
  { id: 'hydra', n: 'Hydra', el: 'tide', plays: 'Gets stronger when hurt.', pow: 'Regrow', powd: 'Heals each round it is hit.',
    feat: 'Hatch all five rare eggs at Pell\'s, over any number of journeys.', need: 5 },
  { id: 'wyrm', n: 'Frost Wyrm', el: 'rime', plays: 'Strong at everything, and costly.', pow: 'Blizzard', powd: 'Slows the whole field.',
    feat: 'Win the Crown.' },
];
const W_STAR_COL = { bloom: '#e0457b', ember: '#ff8a3c', tide: '#6fd0e0', rime: '#d8f2fb', aether: '#b38cf0' };
// a silhouette for each, in a 64 by 64 box
const W_STAR_SIL = {
  phoenix: 'M32 14c3 0 5 3 4 6l-1 3 14-9c4-2 9-2 12 0-6 2-11 6-14 11l-6 6 4 4c3 3 4 8 3 13l-6-6-4 10h-4l-4-10-6 6c-1-5 0-10 3-13l4-4-6-6C22 20 17 16 11 14c3-2 8-2 12 0l14 9-1-3c-1-3 1-6 4-6z',
  kraken: 'M32 6c10 0 17 8 17 18 0 6-3 10-6 13l9 6c3 2 5 6 4 10l-6-6-8-3 4 9c1 3 0 6-2 8l-3-9-5-5 1 10-4 4-4-4 1-10-5 5-3 9c-2-2-3-5-2-8l4-9-8 3-6 6c-1-4 1-8 4-10l9-6c-3-3-6-7-6-13C15 14 22 6 32 6z',
  behemoth: 'M14 22c4-6 12-9 20-9 9 0 17 4 21 11l4 2-1 5-3 1c0 5-2 9-5 11v11h-7v-8H21v8h-7V43c-3-3-5-7-5-12l-4-2 1-5z',
  djinn: 'M32 6c4 0 7 3 7 7 0 3-2 5-4 6 7 2 12 7 12 14l-5-2 2 8c-3 6-8 9-12 11 4 2 6 4 4 7-5 1-10-1-12-3 3-1 5-3 4-5-6-2-10-7-10-13l3-8-5 2c0-7 5-12 12-14-2-1-4-3-4-6 0-4 4-7 8-6z',
  hydra: 'M20 8c4 0 6 3 5 6l-3 9 6 7 4-17c1-3 4-4 6-3 3 1 4 4 3 6l-6 14 7-6 5-10c2-2 5-2 7 0 2 3 0 6-2 7l-8 12c4 3 6 8 6 13v6H14v-6c0-5 2-9 5-12l-6-12c-2-3-2-7 0-9 3-3 6-3 7-5z',
  wyrm: 'M44 6l6 4-3 3c4 1 6 4 6 8l-8-2-5 5c6 3 10 9 10 16 0 10-8 17-18 17-8 0-15-4-18-11l8 2c-3-3-4-7-3-11l6 5c0-6 3-11 8-14l-6-3 8-2-4-6 7 2 2-6z',
};

function wStarsKey() { return pkey('sd-realm-stars'); }
function wStarsAll() {
  let S; try { S = JSON.parse(localStorage.getItem(wStarsKey()) || 'null'); } catch (e) { S = null; }
  S = S && typeof S === 'object' ? S : {};
  return { un: S.un || {}, legs: S.legs || {}, eggs: S.eggs || {}, seen: S.seen || [] };
}
function wStarsSave(S) { if (LAB) return; try { localStorage.setItem(wStarsKey(), JSON.stringify(S)); } catch (e) { } }
function wStar(id) { return W_STARS.find(s => s.id === id) || null; }
function wStarOn(id) { return !!wStarsAll().un[id]; }
function wStarProgress(id, S) {
  S = S || wStarsAll();
  if (id === 'behemoth') return Math.min(3, Object.keys(S.legs).length);
  if (id === 'hydra') return Object.keys(S.eggs).filter(k => DB.rareEggs[k]).length;
  return 0;
}

/* ---------- the feats: read what this journey holds, add it to the profile, unlock what is due ---------- */
function wStarsCheck() {
  if (LAB || !WG) return [];
  const S = wStarsAll(), had = JSON.stringify(S);
  WG.starJ = WG.starJ || 'J' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  for (const id in WG.legBeat || {}) S.legs[WG.starJ + ':' + id] = 1;
  for (const p of wRoster()) if (p.hatched && DB.rareEggs[p.hatched]) S.eggs[p.hatched] = 1;
  const done = {
    phoenix: (WG.gcupWins || 0) > 0,
    kraken: !!(WG.cupLog && WG.cupLog.rime),
    behemoth: wStarProgress('behemoth', S) >= 3,
    djinn: !!(WG.flags && WG.flags.rare_umbralden),
    hydra: wStarProgress('hydra', S) >= Object.keys(DB.rareEggs).length,
    wyrm: (WG.crowns || []).length > 0 || wLegendsAll().length > 0,
  };
  const got = W_STARS.filter(s => done[s.id] && !S.un[s.id]);
  for (const s of got) { const t = new Date(); S.un[s.id] = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
  if (JSON.stringify(S) !== had) wStarsSave(S);
  for (const s of got) {
    wLog(`A superstar is unlocked: the ${s.n}. ${s.feat.replace(/\.$/, '')}: done. From now on they can join a later journey.`, 'g');
    achAdd('realmStars', 1);
  }
  return got.map(s => s.id);
}
const wW57Start = wStart;
wStart = function (a, b) { const r = wW57Start(a, b); wStarsCheck(); return r; };
const wW57CupWon = wCupWon;
wCupWon = function (id) { wW57CupWon(id); if (id === 'rime' || id === 'crown') wStarsCheck(); };
const wW57GcupWon = wGcupWon;
wGcupWon = function () { wW57GcupWon(); wStarsCheck(); };
const wW57SetFlag = wSetFlag;
wSetFlag = function (f) { wW57SetFlag(f); if (f === 'rare_umbralden') wStarsCheck(); };
const wW57HatchEgg = wHatchEgg;
wHatchEgg = function () {
  const egg = WG.incu && WG.incu.egg;
  wW57HatchEgg();
  if (egg && DB.rareEggs[egg] && !LAB) { const S = wStarsAll(); S.eggs[egg] = 1; wStarsSave(S); wStarsCheck(); }
};
const wW57OnLegend = W_ON_END.legend;
W_ON_END.legend = function (r, ref, W) { wW57OnLegend(r, ref, W); if (r === 'win') wStarsCheck(); };

/* ---------- the Stars tab on the Team screen ---------- */
function wStarSil(s, on) {
  return `<svg class="wstsil" viewBox="0 0 64 64" aria-hidden="true"><path d="${W_STAR_SIL[s.id]}" fill="${on ? W_STAR_COL[s.el] : 'currentColor'}"/></svg>`;
}
function wStarRow(s, S, fresh) {
  const on = !!S.un[s.id], n = s.need ? wStarProgress(s.id, S) : 0;
  const prog = !on && s.need ? ` <small class="wstprog">${n} of ${s.need} so far.</small>` : '';
  return `<li class="wstar${on ? ' won' : ''}" data-star="${s.id}">${wStarSil(s, on)}<div>
    <span class="wstn"><b>${on ? esc(s.n) : '???'}</b>${on && fresh ? ' <span class="wtag">New</span>' : ''}</span> <small class="k">${on ? `${esc(wCap(s.el))}. ${esc(s.plays)}` : `A superstar of ${esc(s.el)}.`}</small>
    ${on ? `<small>Power: <b>${esc(s.pow)}</b>. ${esc(s.powd)}</small><small class="wgood">Unlocked on ${esc(S.un[s.id])}.</small>` : `<small>To unlock: ${esc(s.feat)}${prog}</small>`}</div></li>`;
}
function wCampStars() {
  const S = wStarsAll(), fresh = W_STARS.filter(s => S.un[s.id] && !S.seen.includes(s.id)).map(s => s.id), n = Object.keys(S.un).length;
  if (fresh.length) { S.seen = S.seen.concat(fresh); wStarsSave(S); }
  return `<p class="hint">Superstars are monsters of a kind no club and no tavern has. Each one is unlocked by a feat, and an unlock is kept for every later journey on this profile. Once unlocked, a superstar can be met in a later journey and asked to sign; they join at your team's average level. One superstar a journey.</p>
    <p class="hint">Unlocked: <b>${n} of ${W_STARS.length}</b>.${n ? ' Meeting them in the world comes in a later update.' : ''}</p>
    <ol class="wstars">${W_STARS.map(s => wStarRow(s, S, fresh.includes(s.id))).join('')}</ol>`;
}
const wW57OpenCamp = wOpenCamp;
wOpenCamp = function (tab) {
  const want = tab || WCAMP.tab;
  if (want === 'stars') WCAMP.tab = 'team';
  wW57OpenCamp(want === 'stars' ? 'team' : tab);
  const tabs = document.querySelector('#modalBox .wctabs');
  if (!tabs || tabs.querySelector('[data-ctab="stars"]')) return;
  tabs.lastElementChild.insertAdjacentHTML('afterend', '<button role="tab" data-ctab="stars">Stars</button>');
  tabs.querySelector('[data-ctab="stars"]').onclick = () => { WCAMP.tab = 'stars'; WCAMP.swap = null; WCAMP.msg = ''; wRenderCamp(); };
  if (want === 'stars') { WCAMP.tab = 'stars'; wRenderCamp(); }
};
const wW57RenderCamp = wRenderCamp;
wRenderCamp = function () {
  if (WCAMP.tab !== 'stars') return wW57RenderCamp();
  const body = $('wCampBody'); if (!body) return;
  if (!$('modalBox').querySelector('[data-ctab="stars"]')) { WCAMP.tab = 'team'; return wRenderCamp(); }
  $('modalBox').querySelectorAll('[data-ctab]').forEach(b => { const on = b.dataset.ctab === 'stars'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on); });
  body.innerHTML = wCampStars();
};

ACH.push({ id: 'w_stars', n: 'Star Finder', d: 'Unlock superstars, kept across journeys', stat: 'realmStars', at: [1, 3, 6] });

const wW57RenderHelp = renderHelp;
renderHelp = function () {
  wW57RenderHelp();
  const after = $('wHelpLegends'); if (!after || $('wHelpStars')) return;
  after.insertAdjacentHTML('afterend', `<p class="hint" id="wHelpStars"><b>Superstars.</b> Six monsters of kinds no club and no tavern has, each unlocked by a feat: win the Cinder Cup, win the Rimewatch cup, beat three legends, walk the Road to Nowhere to its end, hatch all five rare eggs, or win the Crown. Beating legends and hatching eggs add up over any number of journeys. An unlock is kept on your profile for every later journey. The Stars tab on the Team screen shows them all, and what each one still needs. Once unlocked, a superstar can be met in a later journey and signed, one a journey, at your team's average level.</p>`);
};
