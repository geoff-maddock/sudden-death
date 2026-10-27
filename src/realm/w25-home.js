/* w25: home grounds move to the sports grounds (issue #6, phase 6). Loads after w24-fixtures.js; changes earlier parts
   only by reassignment (saved originals carry the wW25 prefix).

   The home ground (w14) is now one of the ten sports grounds, not a plot behind an inn. Ask any groundskeeper about a
   HOME ground, or the innkeeper about the GROUND (they point you at the city's two). Everything the home ground did
   still holds: its city's region is home, the four upgrades, the free beds (at the ground, or the city's inn
   button), the kitchen and the scouts at that city's inn. New: you host your league fixture at your own ground every
   other round (not at the Ballpark, whose games are ball games), with your crowd behind you.

   WG.ground.grd   the ground's id (WG.ground.town stays its city, so everything keyed on the town still works)
   Old saves: a ground bought behind an inn becomes the first of that city's grounds, once, with a line in the log.

   Wrapped: wBuyGround (wW25BuyGround: a ground id or a town), wOpenGround (wW25OpenGround: the sale lists the city's
   grounds; the screen is named for your ground; Host a ball game at the Ballpark only), wSleepGround (at the ground's own map too), wStart (the old-save
   move), wDrawRound (your home fixtures), wSay (the keeper welcomes you home), renderHelp (#wHelpGround's words). */

function wHomeGrd() { const G = wHomeGround(); return G && G.grd ? wGrd(G.grd) : null; }
// a town, or a ground's map: the city it belongs to, and the ground if it is one
function wGrdPlace(where) { const g = wGrd(where); return g ? { town: g.city, g } : { town: where, g: null }; }

const wW25BuyGround = wBuyGround;
wBuyGround = function (where) {
  where = where || WG.map;
  const P = wGrdPlace(where), g = P.g || wGrdsOf(P.town)[0];
  if (!g && !wHomeGround()) return 'There is no ground for sale here.';
  const r = wW25BuyGround(P.town);
  if (!r && WG.ground) { WG.ground.grd = g.id; wLog(`${g.name} is your home ground.`, 'g'); wSave(); }
  return r;
};

/* ---------- the screen ---------- */
const wW25OpenGround = wOpenGround;
wOpenGround = function (where, msg) {
  where = where || WG.map;
  const P = wGrdPlace(where), G = wHomeGround();
  if (G) {
    wW25OpenGround(G.town === P.town ? G.town : P.town, msg);
    const h = document.querySelector('#modalBox h3'), H = wHomeGrd();
    if (h && H && G.town === P.town) h.textContent = 'Your ground: ' + H.name;
    if (H && G.town !== P.town) { const p = document.querySelector('#modalBox p'); if (p) p.insertAdjacentHTML('afterbegin', `${esc(H.name)}. `); }
    // ball games are hosted at the Ballpark only: the other grounds play their own sports
    if (H && H.sport !== 'baseball' && $('wGroundBall')) $('wGroundBall').remove();
    return;
  }
  const list = P.g ? [P.g] : wGrdsOf(P.town), rg = DB.regions[W_GRD_REG[P.town]] || DB.regions.plains;
  if (!list.length) { modal(`<header><h3>A home ground</h3><button class="ghost" data-close>Done</button></header><p class="hint">There is no ground for sale here.</p>`); return; }
  const close = modal(`<header><h3>A home ground${P.g ? ': ' + esc(P.g.name) : ', ' + esc(wTownName(P.town))}</h3><button class="ghost" data-close>Done</button></header>${msg ? `<p class="wbad">${esc(msg)}</p>` : ''}
    <p>The League sells ${P.g ? 'this ground' : 'the grounds outside ' + esc(wTownName(P.town))} for <b class="wgold">${W_GROUND.price} gold</b>. You have ${RUN.gold}.</p>
    <p class="hint">Buy one and ${esc(rg.name.replace(/^The /, 'the '))} is home: every match in the region has your crowd behind it (not the Crown, which is neutral ground), and you host your league fixture there every other round. Build stands, a training pitch, a kitchen and a scout's office. The ground has beds, free. You can only own one, so choose the region you will play in most.</p>
    <ul class="wbclubs">${list.map((g, i) => `<li class="wbcl"><span class="wbsw" style="background:${W_GRD_COL[g.sport]}"></span><div><b>${esc(g.name)}</b><small>${esc(SPORT_NAME[g.sport])}${g.sport === 'baseball' ? ': host ball games on the diamond' : ''}.</small></div>
      <div class="row"><button class="btn" ${i ? '' : 'id="wBuyGround"'} data-wbuy="${g.id}" ${RUN.gold < W_GROUND.price ? 'disabled' : ''}>Buy (${W_GROUND.price} gold)</button></div></li>`).join('')}</ul>`);
  $('modalBox').querySelectorAll('[data-wbuy]').forEach(b => b.onclick = () => { const id = b.dataset.wbuy, r = wBuyGround(id); close(); wDrain(); wOpenGround(r ? where : id, r); });
};

/* the beds are at the ground (and, as before, behind the city's inn button); after a blackout you wake at the city's inn */
const wW25SleepGround = wSleepGround;
wSleepGround = function () {
  const G = wHomeGround();
  if (G && G.grd && WG.map === G.grd) { const m = WG.map; WG.map = G.town; try { return wW25SleepGround(); } finally { WG.map = m; } }
  return wW25SleepGround();
};

/* ---------- old saves: the ground behind the inn becomes one of the city's grounds ---------- */
const wW25Start = wStart;
wStart = function (save, opts) {
  const r = wW25Start(save, opts);
  const G = WG && WG.ground;
  if (G && !G.grd) { const g = wGrdsOf(G.town)[0]; if (g) { G.grd = g.id; wLog(`The League has moved your home ground: it is ${g.name} now, outside ${wTownName(G.town)}. Your upgrades came with it.`, 'g'); wSave(); } }
  return r;
};

/* ---------- your home fixtures ---------- */
const wW25DrawRound = wDrawRound;
wDrawRound = function () {
  const R = wW25DrawRound(), H = wHomeGrd();
  if (H && H.sport !== 'baseball' && (wLeague().hosted = !wLeague().hosted)) {
    const f = R.games.find(x => x.b === 'me');
    if (f) { f.b = f.a; f.a = 'me'; f.g = H.id; }
  }
  return R;
};

/* ---------- talk ---------- */
for (const g of W_GRDS) {
  const K = DB.chars['gk_' + g.id.slice(2)];
  K.topics.home = { t: `The League will sell you this ground for ${W_GROUND.price} gold. Your crowd, your beds, your fixtures. Here are the terms.`, act: 'ground' };
  K.topics.job.t += ' The League will sell you this ground as your HOME.';
}
for (const town in W_GROUND.inns) {
  const ch = DB.chars[W_GROUND.inns[town]]; if (!ch) continue;
  ch.topics.ground.t = 'The old ground out back is gone: the League sells the sports grounds outside the gate now. Either one, for the right price, and a team plays better at home.';
}
const wW25Say = wSay;
wSay = function (id, kw) {
  const r = wW25Say(id, kw), H = wHomeGrd();
  if (H && id === 'gk_' + H.id.slice(2) && !(kw || '').trim()) r.text = 'Welcome home, boss. The ground is as you left it, give or take a pigeon.';
  return r;
};
TIPS.w_ground[1] = 'The League sells the sports grounds outside every city. Buy one and its region is home: your crowd at every match there, free beds, upgrades to spend your gold on, and your league fixtures at home every other round. Ask a groundskeeper about a HOME ground.';

/* ---------- How to play ---------- */
const wW25RenderHelp = renderHelp;
renderHelp = function () {
  wW25RenderHelp();
  const h = $('wHelpGround'); if (!h || h.dataset.w25) return;
  h.dataset.w25 = '1';
  const p = h.querySelector('p');
  const ball = $('wHelpBall'); if (ball) ball.innerHTML = ball.innerHTML.replace('Host a ball game at your ground', 'Host a ball game at your ground if it is the Ballpark');
  if (p) p.innerHTML = `Your home ground is one of the sports grounds outside the cities, for ${W_GROUND.price} gold: ask its groundskeeper about a HOME ground (or the innkeeper about the GROUND). You can own one. Its region is <b>home</b>: every match there has your crowd behind it, except the Crown, which is neutral ground, and you host your league fixture there every other round. The ground has beds, free, and you wake there after a blackout if you slept there last.`;
};
