/* w30: weather (epic 2, phase 7). Loads after w29-captain.js; changes earlier parts only by reassignment (saved
   originals carry the wW30 prefix).

   Three regions have weather, rolled each morning: blizzards in the Frostspire, fog on the Brinefen, ash storms in the
   Cindermaw. The Charter Plains and the Mosswold stay fair. Like night, weather changes a match out in the open: a
   wild game, a grudge, a camp, an alpha or lair out in the world, or a game at an outdoor ground (not the bowling,
   curling or boxing halls). Cups and dungeons are under cover.

     Blizzard   2 Frostbite cards go into your draw pile (unplayable; they melt at the end of the turn), and every
                enemy starts Weak for a turn: they are cold too
     Fog        both sides start with 6 Block; by day, a wild game off the road can be an ambush, as at night
     Ash storm  both sides start with 4 Burn

   Each side also carries a marker for the match (Snowed In, Fogbound, Ash-choked; Sudden Death statuses), so cards
   can play off it with ['ifst', marker, yes, no]. Three new cards do: Whiteout (hockey), Fog Bank (curling) and Cinder
   Wind (football), in the region's card pools.

   WG.wx = { day, by: { region: 'blizzard' | 'fog' | 'ash' } }, rolled on the first look each day; plain data.
   W_WX, wWeather(region), wMatchWeather(W)
   Wrapped: wBuildEncounter (enc.world.wx; fog's day ambush), wPreGame (the weather line), wRenderHud (the weather by
   the region's name), wRender (snow, fog or ash over the world), renderHelp (#wHelpWeather).
   A fightStart hook applies it. Also a tip (w_weather). */

const W_WX = {
  blizzard: { region: 'rime', p: .3, n: 'Blizzard', mark: 'snowed', d: '2 Frostbite cards in your draw pile; every enemy starts Weak for a turn.', frost: 2, weak: 1 },
  fog: { region: 'tide', p: .35, n: 'Fog', mark: 'fogbound', d: 'Both sides start with 6 Block. By day, a wild game off the road can be an ambush.', block: 6, ambush: .35 },
  ash: { region: 'ember', p: .3, n: 'Ash storm', mark: 'ashen', d: 'Both sides start with 4 Burn.', burn: 4 },
};
const W_WX_INDOOR = ['bowling', 'curling', 'boxing'];
const W_WX_OUT = ['wild', 'event', 'camp', 'alpha', 'lair', 'tour'];
Object.assign(ST, {
  snowed: { n: 'Snowed In', col: '#cfe8f0', desc: 'A blizzard is blowing. Some cards do more in one.' },
  fogbound: { n: 'Fogbound', col: '#9aa6ae', desc: 'Thick fog. Some cards do more in it.' },
  ashen: { n: 'Ash-choked', col: '#c8763a', desc: 'An ash storm. Some cards do more in one.' },
});
K('wx_whiteout', 'Whiteout', 'any', 'skl', 1, 'u', 'self', [['ifst', 'snowed', [['b', 13]], [['b', 7]]]], { sport: 'hockey', fl: 'You cannot hit what you cannot see.' });
K('wx_fogbank', 'Fog Bank', 'any', 'skl', 1, 'u', 'one', [['ifst', 'fogbound', [['s', 'weak', 2], ['s', 'vuln', 2]], [['s', 'weak', 1]]]], { sport: 'curling', fl: 'Where did the house go?' });
K('wx_cinder', 'Cinder Wind', 'any', 'atk', 1, 'u', 'one', [['ifst', 'ashen', [['d', 15]], [['d', 8]]]], { sport: 'football', fl: 'Play with the wind at your back.' });

/* ---------- today's weather ---------- */
function wWeather(region) {
  if (!WG) return null;
  if (!WG.wx || WG.wx.day !== WG.dayAbs) {
    const by = {};
    for (const k in W_WX) if (Math.random() < W_WX[k].p) by[W_WX[k].region] = k;
    WG.wx = { day: WG.dayAbs, by };
  }
  return WG.wx.by[region] || null;
}
/* the weather a match is played in: out in the world, or at an outdoor ground */
function wMatchWeather(W) {
  if (!W || !W.region) return null;
  const k = wWeather(W.region); if (!k) return null;
  if (W.kind === 'ground') { const g = wGrd(W.ref && W.ref.g); return g && !W_WX_INDOOR.includes(g.sport) ? k : null; }
  return W_WX_OUT.includes(W.kind) && (W.map === 'world' || (MAPS[W.map] || {}).kind === 'world') ? k : null;
}
const wW30BuildEncounter = wBuildEncounter;
wBuildEncounter = function (o) {
  const enc = wW30BuildEncounter(o), W = enc.world, k = wMatchWeather(W);
  if (k) {
    W.wx = k;
    if (k === 'fog' && W.kind === 'wild' && !W.night && !W.ambush && !wOnRoad() && !(o && o.ambush != null) && Math.random() < W_WX.fog.ambush) W.ambush = 1;
  }
  return enc;
};

/* ---------- at kickoff ---------- */
onHook('fightStart', () => {
  const W = RUN && RUN.pending && RUN.pending.world, X = W && W.wx && W_WX[W.wx];
  if (!WG || !B || !X) return;
  for (const t of [B.P, ...alive()]) addSt(t, X.mark, 1);
  if (X.frost) for (let i = 0; i < X.frost; i++) B.draw.splice(Math.floor(Math.random() * (B.draw.length + 1)), 0, mkCard('frostbite'));
  if (X.weak) for (const e of alive()) addSt(e, 'weak', X.weak);
  if (X.block) { B.P.block += X.block; for (const e of alive()) e.block += X.block; }
  if (X.burn) { addSt(B.P, 'burn', X.burn); for (const e of alive()) addSt(e, 'burn', X.burn); }
  B.wWx = W.wx;
  log(`${X.n}: ${X.d}`, 'sys');
  if (!LAB) fx({ k: 'banner', t: X.n, sub: X.d, small: 1 });
});

/* ---------- words ---------- */
const wW30PreGame = wPreGame;
wPreGame = function (enc) {
  wW30PreGame(enc);
  const box = document.querySelector('#modalBox .wpgtxt'), X = enc.world.wx && W_WX[enc.world.wx]; if (!box || !X) return;
  box.insertAdjacentHTML('beforeend', `<p class="hint wwx wwx-${enc.world.wx}"><b>${esc(X.n)}.</b> ${esc(X.d)}</p>`);
};
const wW30RenderHud = wRenderHud;
wRenderHud = function () {
  const k0 = WUI.hudKey;
  wW30RenderHud();
  if (WUI.hudKey === k0 || !WG) return;
  const m = wCurMap(), k = m && m.kind === 'world' ? wWeather(wRegionHere()) : m && m.grd ? wWeather(W_GRD_REG[(wGrd(m.grd) || {}).city]) : null;
  const sm = document.querySelector('#wHud .wwhere small');
  if (k && sm) sm.insertAdjacentHTML('beforeend', ` &middot; <span class="wwxhud wwx-${k}" title="${esc(W_WX[k].d)}">${esc(W_WX[k].n)}</span>`);
};

/* ---------- drawing: snow, fog or ash over the world, in screen space ---------- */
function wDrawWeather(c, k, w, h, t) {
  c.save();
  const u = Math.max(1, w / 900);   // device pixels per CSS pixel, roughly
  if (k === 'blizzard') {
    c.fillStyle = 'rgba(225,238,248,.2)'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(252,253,255,.9)';
    for (let i = 0; i < 260; i++) {
      const sx = (i * 97.31) % 1, sy = (i * 57.13) % 1, sp = .6 + (i % 5) * .18, r = (1.2 + (i % 3) * .8) * u;
      const x = ((sx * w + t * 110 * sp * u + Math.sin(t * 1.3 + i) * 14 * u) % w + w) % w, y = ((sy * h + t * 120 * sp * u) % h + h) % h;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
  } else if (k === 'fog') {
    for (let i = 0; i < 6; i++) {
      const y = h * (i + .5) / 6 + Math.sin(t * .2 + i) * 18, x = ((t * 8 * (1 + i % 3) + i * 170) % (w + 400)) - 200;
      const g = c.createRadialGradient(x, y, 10, x, y, w * .45);
      g.addColorStop(0, 'rgba(200,208,214,.28)'); g.addColorStop(1, 'rgba(200,208,214,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    c.fillStyle = 'rgba(190,198,204,.14)'; c.fillRect(0, 0, w, h);
  } else if (k === 'ash') {
    c.fillStyle = 'rgba(110,50,24,.2)'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) {
      const sx = (i * 61.7) % 1, sy = (i * 23.9) % 1, sp = .5 + (i % 4) * .2;
      const x = ((sx * w + t * 80 * sp * u) % w + w) % w, y = ((sy * h + t * 26 * sp * u + Math.sin(t + i) * 10 * u) % h + h) % h;
      c.fillStyle = i % 6 ? 'rgba(48,40,36,.75)' : 'rgba(255,150,60,.95)';
      c.fillRect(x, y, 3.2 * u, 2.2 * u);
    }
  }
  c.restore();
}
const wW30Render = wRender;
wRender = function (now) {
  wW30Render(now);
  if (!WUI.built || !WG || !WUI.c) return;
  const m = wCurMap(); if (!m || m.kind !== 'world') return;
  const k = wWeather(wRegionHere()); if (!k) return;
  const c = WUI.c;
  c.save();
  try { c.setTransform(1, 0, 0, 1, 0, 0); wDrawWeather(c, k, WUI.cv.width, WUI.cv.height, G.time); }
  finally { c.restore(); }
};

/* ---------- a tip ---------- */
TIPS.w_weather = ['Weather', 'Bad weather here today: it changes every match out in the open (the top bar says what it is). Cups, dungeons and indoor halls are under cover.'];
setInterval(() => {
  if (LAB || !SET.tips || !WG || !RUN || UI.screen !== 'run' || UI.view !== 'world') return;
  const m = wCurMap(); if (m && m.kind === 'world' && wWeather(wRegionHere())) tip('w_weather');
}, 900);

/* ---------- How to play ---------- */
const wW30RenderHelp = renderHelp;
renderHelp = function () {
  wW30RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpWeather')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpWeather"><b>Weather.</b> Each morning brings its own: blizzards in the Frostspire, fog on the Brinefen, ash storms in the Cindermaw (the top bar says so). Like night, weather changes a match out in the open, and at the outdoor grounds; cups, dungeons and the indoor halls are under cover. ${Object.values(W_WX).map(X => `<b>${X.n}</b>: ${X.d}`).join(' ')} Whiteout, Fog Bank and Cinder Wind are cards that do more in their weather.</p>`);
};
