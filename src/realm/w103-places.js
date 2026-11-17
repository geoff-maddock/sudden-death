/* w103: places, the cities (issue #90). Loads after w102-fanfeel.js; changes earlier parts only by reassignment
   (saved originals carry the wW103 prefix).

   A building style per city. Each city builds in its own material, on its wall faces and on the wall tops (its
   roofs, in this cutaway view): Graftonbury red brick under blue slate, Mossgate bark and log under moss and thatch,
   Saltmere whitewashed boards under red tile, Cinderhold black basalt with glowing seams under riveted iron, Rimewatch
   pale stone under snow. Grounds and secret sites take the style of the city or region they sit in; the Coliseum is
   marble. W_STYLE (the materials), W_PLACE_STYLE (map id to style), wStyleOf(m).

   Buildings you can recognise from the street. Every building of a city gets a kind (wBldKind: arena, office, shop,
   inn, smithy, chapel, workshop, warehouse, tower, canteen, apiary, home), read from its keeper and its sign, and its
   front wall says so (wFacadePlan, kept in m.fac, never saved): a hanging sign with an icon by the door, windows with
   shutters, awnings over shops, pennants on arenas, a lantern by an inn's door (lit at night), flower boxes on homes,
   chimneys on homes, inns and smithies. Doors come in the style's colours, one per building.

   Landmarks, with something to do (W_LANDMARKS, placed by wPlaceLandmarks after the maps are built, never breaking
   a city's reach; new tiles, use 'feature', handled by wFeatureUse):
     Graftonbury  the Charter Clock (the hour, the day, the days to the Crown), a wishing well (a coin, a fortune)
     Mossgate     a mushroom ring (rest: heals the team a little, once a day)
     Saltmere     a fishing spot off the pier end (a catch, once a day), lobster pots
     Cinderhold   the forge stack (warm up: rests tired legs, once a day), ore carts
     Rimewatch    an ice statue of the champion, snowmen
   and street life: washing lines and haystacks.

   The world map draws each city's own icon (WOBJ.O) and each dungeon's own door (WOBJ.D).

   W_STYLE, W_PLACE_STYLE, W_BLD_ICON, W_LANDMARKS, W_FEATURE, wStyleOf, wBldKind, wFacadePlan, wPlaceLandmarks,
   wFeatureUse, wPutNear
   Wrapped: buildAllMaps (wW103BuildAllMaps: facades and landmarks after the build), wWallFace (wW103WallFace: the
   styled walls), wUse (wW103Use: 'feature' tiles), wTileVariant (wW103TileVariant: once-a-day features), renderHelp
   (wW103RenderHelp: #wHelpPlaces). Replaces WOBJ['+'], WOBJ.O and WOBJ.D. */

/* ---------- the materials ---------- */
const W_STYLE = {
  brick:     { face: 'brick', cap: 'slate', wall: '#a9533c', wallD: '#7c3828', mortar: '#dccab0', roof: '#56697f', trim: '#efe3c8', shutter: '#3f5a8a', door: ['#3f5a8a', '#8a2f2a', '#2f6a4a', '#6a4a8a', '#c98a3a'], awn: ['#c94a3a', '#f4ead2'] },
  bark:      { face: 'log', cap: 'thatch', wall: '#7a5636', wallD: '#4f3620', mortar: '#a88a5a', roof: '#a08a3e', moss: '#5d8a3a', trim: '#c8b27a', shutter: '#5d8a3a', door: ['#6a8a3a', '#8a5a2a', '#4a6a5a', '#9a7a3a'], awn: ['#5d8a3a', '#e8dca0'] },
  clapboard: { face: 'boards', cap: 'tile', wall: '#ece6d6', wallD: '#c2bba8', mortar: '#a9a28e', roof: '#b5523a', trim: '#3f7d9a', shutter: '#3f7d9a', door: ['#3f7d9a', '#2a4a6a', '#c94a3a', '#e0b84a'], awn: ['#3f7d9a', '#f4f0e4'] },
  basalt:    { face: 'basalt', cap: 'iron', wall: '#3b3437', wallD: '#241f22', mortar: '#ff8a3c', roof: '#5f5d63', trim: '#c98a3a', shutter: '#5f5d63', door: ['#5a3a2a', '#3a3a40', '#7a2a1e', '#4a4a3a'], awn: ['#7a2a1e', '#e0c08a'] },
  stone:     { face: 'ashlar', cap: 'snow', wall: '#c8c5be', wallD: '#9a978f', mortar: '#7d7a73', roof: '#f4f8fa', trim: '#5a6a8a', shutter: '#4a6a9a', door: ['#4a6a9a', '#6a3a4a', '#3a5a5a', '#8a6a3a'], awn: ['#4a6a9a', '#eef2f4'] },
  marble:    { face: 'marble', cap: 'gold', wall: '#ece4d0', wallD: '#c8bea4', mortar: '#b8ad92', roof: '#c9a040', trim: '#c9a040', shutter: '#8a2f2a', door: ['#8a2f2a', '#3f5a8a'], awn: ['#8a2f2a', '#f2c14e'] },
};
const W_PLACE_STYLE = {
  graftonbury: 'brick', mossgate: 'bark', saltmere: 'clapboard', cinderhold: 'basalt', rimewatch: 'stone', coliseum: 'marble',
  hollowshrine: 'bark', marigold: 'clapboard', frozenchapel: 'stone', deepseamcamp: 'basalt',
};
const W_REGION_STYLE = { plains: 'brick', bloom: 'bark', tide: 'clapboard', ember: 'basalt', rime: 'stone' };
function wStyleOf(m) {
  if (!m || m.kind !== 'town') return null;
  if (m._wsty !== undefined) return m._wsty;
  let id = W_PLACE_STYLE[m.id];
  if (!id && typeof wGrd === 'function') { const g = wGrd(m.id); if (g) id = W_PLACE_STYLE[g.city]; }
  return m._wsty = id ? Object.assign({ id }, W_STYLE[id]) : null;
}

/* ---------- what a building is, from its keeper and its sign ---------- */
function wBldKind(b) {
  const s = String(b.sign || '').toUpperCase(), n = b.npc || '';
  if (!b.npc && !b.sign) return 'home';
  if (/ARENA/.test(s)) return 'arena';
  if (/BEDS/.test(s) || /_inn$/.test(n)) return 'inn';
  if (/LEAGUE OFFICE/.test(s)) return 'office';
  if (/CHAPEL|SHRINE|ABBEY/.test(s)) return 'chapel';
  if (/SHOES|SMITH|BRANDT/.test(s) || n === 'smith') return 'smithy';
  if (/WORKSHOP/.test(s)) return 'workshop';
  if (/WAREHOUSE/.test(s)) return 'warehouse';
  if (/LIGHTHOUSE|TOWER/.test(s)) return 'tower';
  if (/CANTEEN/.test(s)) return 'canteen';
  if (/APIARY/.test(s)) return 'apiary';
  return 'shop';
}
const W_BLD_ICON = { inn: 'tankard', shop: 'purse', smithy: 'anvil', chapel: 'bell', arena: 'ball', office: 'scroll', workshop: 'flask', canteen: 'bowl', warehouse: 'crate', tower: 'lamp', apiary: 'bee', home: null };
const W_CHIMNEY = { home: 1, inn: 1, smithy: 1, canteen: 1, workshop: 1 };

/* the front of every building of a town map: m.fac['x,y'] = { k: 'win'|'sign'|'lamp'|'door2'|..., kind, b } */
function wFacadePlan(m, def) {
  m.fac = {}; m.bldK = [];
  if (!def || !def.buildings) return;
  const put = (x, y, f) => { if (m.t[y] && m.t[y][x] === '#') m.fac[x + ',' + y] = Object.assign(m.fac[x + ',' + y] || {}, f); };
  def.buildings.forEach((b, bi) => {
    const kind = wBldKind(b), n = b.door === 'n', dx = b.x + (b.w >> 1), fy = b.y + b.h - 1, by = b.y;
    m.bldK.push([b.x, b.y, b.w, b.h, kind]);
    const doorCol = bi;
    if (!n) m.fac[dx + ',' + fy] = { k: 'door', kind, col: doorCol }; else m.fac[dx + ',' + by] = { k: 'door', kind, col: doorCol };
    // the sign, by the door
    const icon = W_BLD_ICON[kind];
    const sx = dx + 1 < b.x + b.w - 1 ? dx + 1 : dx - 1;
    if (icon) put(sx, n ? by : fy, { k: 'sign', icon, kind, cap: n });
    // the south face, the one you see: windows and the kind's dressing
    for (let x = b.x + 1; x < b.x + b.w - 1; x++) {
      if (x === dx && !n) continue;
      if (!n && x === sx && icon) continue;
      const odd = (x - b.x) % 2 === 1;
      let f = null;
      if (kind === 'arena') f = odd ? { k: 'pennant', kind, i: x } : { k: 'win', kind, tall: 1 };
      else if (kind === 'chapel') f = { k: 'stained', kind, i: x };
      else if (kind === 'smithy') f = odd ? { k: 'vent', kind } : { k: 'soot', kind };
      else if (kind === 'warehouse') f = { k: 'bay', kind, i: x - b.x };
      else if (kind === 'tower') f = odd ? { k: 'slit', kind } : null;
      else if (kind === 'apiary') f = null;
      else if (odd || b.w <= 5) f = { k: 'win', kind, box: kind === 'home' || kind === 'inn', lit: kind === 'inn' || kind === 'canteen' };
      else f = { k: 'plain', kind };
      if (f && (kind === 'shop' || kind === 'canteen')) f.awn = 1;
      if (f) put(x, fy, f);
    }
    if (kind === 'inn' && !n && m.t[fy][dx - 1] === '#') { put(dx - 1, fy, { k: 'lamp', kind }); m.light.push([dx - 1, fy + 1, 2]); }
    // chimney on the back wall
    if (W_CHIMNEY[kind]) { const cx = b.x + b.w - 2; if (!m.fac[cx + ',' + by] || m.fac[cx + ',' + by].k !== 'door') put(cx, by, { k: 'chimney', kind, hot: kind === 'smithy' }); }
    // pennants on the arena's back corners
    if (kind === 'arena') { put(b.x + 1, by, { k: 'flagpole', kind }); put(b.x + b.w - 2, by, { k: 'flagpole', kind }); }
  });
}

/* ---------- drawing a styled wall ---------- */
function wW103IsW(e, dx, dy) { const ch = e.at(dx, dy); if (ch == null) return true; if (WWALL[ch]) return true; const mt = wMeta(e.m, e.x + dx, e.y + dy); return !!(mt && mt.under && WWALL[mt.under]); }
function wStyledCap(c, st, e, h, front) {
  const r = wRng((e.x * 131 + e.y * 977) | 0);
  c.fillStyle = st.roof; c.fillRect(0, 0, 32, h);
  switch (st.cap) {
    case 'slate': case 'tile': {
      const rows = Math.max(1, Math.round(h / 5));
      for (let i = 0; i < rows; i++) {
        const y = i * (h / rows), off = (i % 2) * 4;
        c.fillStyle = tint(st.roof, (i % 2 ? -.06 : .04)); c.fillRect(0, y, 32, h / rows);
        c.beginPath(); for (let x = -off; x < 34; x += 8) { if (st.cap === 'tile') c.arc(x + 4, y + h / rows, 4, Math.PI, 0); else c.rect(x, y, 8, h / rows); }
        c.lineWidth = .6; c.strokeStyle = 'rgba(20,14,10,.45)'; c.stroke();
      }
      break;
    }
    case 'thatch': {
      for (let i = 0; i < 26; i++) { const x = r() * 32, y = r() * h; wLine(c, [[x, y], [x + 2 + r() * 3, y + 3]], .7, i % 3 ? 'rgba(90,70,20,.55)' : 'rgba(255,240,170,.4)'); }
      for (let i = 0; i < 3; i++) { const p = wBlob(r() * 32, r() * h, 3 + r() * 2, 2, r, 6); c.fillStyle = st.moss; c.fill(p); }
      break;
    }
    case 'iron': {
      for (let x = 0; x < 32; x += 16) { c.fillStyle = tint(st.roof, x ? -.08 : .06); c.fillRect(x, 0, 16, h); wLine(c, [[x, 0], [x, h]], .7, 'rgba(0,0,0,.55)'); }
      c.fillStyle = '#a8a6aa'; for (const x of [3, 13, 19, 29]) for (let y = 2.5; y < h; y += 8) { c.beginPath(); c.arc(x, y, .9, 0, 7); c.fill(); }
      break;
    }
    case 'snow': {
      // grey slate showing under the snow, a drift on top, and a blue shadow along the eave so it stands off a snowfield
      c.fillStyle = '#6f7d8c'; c.fillRect(0, 0, 32, h);
      for (let x = 0; x < 32; x += 8) wLine(c, [[x, 0], [x, h]], .5, 'rgba(20,30,40,.5)');
      const p = new Path2D(); p.moveTo(0, h * .62); for (let x = 0; x <= 32; x += 4) p.lineTo(x, 1 + Math.sin(x * .7 + e.x) * 1.2); p.lineTo(32, h * .62);
      for (let x = 32; x >= 0; x -= 4) p.lineTo(x, h * .62 + Math.sin(x * 1.3 + e.y) * 1.4 + 1); p.closePath();
      c.fillStyle = st.roof; c.fill(p); c.lineWidth = .7; c.strokeStyle = 'rgba(90,120,150,.7)'; c.stroke(p);
      break;
    }
    case 'gold': {
      c.fillStyle = st.wall; c.fillRect(0, 0, 32, h); c.fillStyle = st.roof; c.fillRect(0, h * .35, 32, h * .3);
      wLine(c, [[0, h * .35], [32, h * .35]], .6, 'rgba(60,40,10,.5)'); wLine(c, [[0, h * .65], [32, h * .65]], .6, 'rgba(60,40,10,.5)');
      break;
    }
  }
  c.fillStyle = 'rgba(255,240,210,.14)'; c.fillRect(0, 0, 32, 1.6);
  // icicles under a snowy eave
  if (front && st.cap === 'snow') { c.fillStyle = 'rgba(230,245,255,.95)'; for (let x = 2; x < 32; x += 5) { const l = 2 + wHash(e.x * 7 + x, e.y, 61) * 5; c.beginPath(); c.moveTo(x - 1.2, h); c.lineTo(x + 1.2, h); c.lineTo(x, h + l); c.closePath(); c.fill(); } }
  if (front && st.cap === 'thatch') { c.fillStyle = st.moss; for (let x = 1; x < 32; x += 3.5) { c.beginPath(); c.arc(x, h, 1.6 + wHash(x | 0, e.x + e.y, 62), 0, Math.PI); c.fill(); } }
}
function wStyledFace(c, st, e, fy, fh) {
  const r = wRng((e.x * 733 + e.y * 211) | 0);
  c.fillStyle = st.wall; c.fillRect(0, fy, 32, fh);
  switch (st.face) {
    case 'brick': {
      const bh = fh / 5;
      for (let i = 0; i < 5; i++) {
        const y = fy + i * bh, off = (i % 2) * 4;
        for (let x = -off; x < 32; x += 8) { c.fillStyle = tint(st.wall, (wHash(e.x * 4 + x, e.y * 5 + i, 63) - .5) * .22); c.fillRect(x + .5, y + .5, 7, bh - 1); }
      }
      c.fillStyle = st.mortar; c.globalAlpha = .55; for (let i = 0; i <= 5; i++) c.fillRect(0, fy + i * bh - .4, 32, .8); c.globalAlpha = 1;
      break;
    }
    case 'log': {
      const lh = fh / 4;
      for (let i = 0; i < 4; i++) {
        const y = fy + i * lh; c.fillStyle = tint(st.wall, i % 2 ? -.08 : .05); c.fillRect(0, y, 32, lh);
        c.fillStyle = 'rgba(255,230,180,.18)'; c.fillRect(0, y + .8, 32, 1);
        wLine(c, [[0, y + lh], [32, y + lh]], .8, 'rgba(29,20,15,.65)');
        for (let k = 0; k < 2; k++) { const x = r() * 28; wLine(c, [[x, y + lh * .5], [x + 4, y + lh * .55]], .5, 'rgba(29,20,15,.35)'); }
      }
      if (!wW103IsW(e, -1, 0) || !wW103IsW(e, 1, 0)) {
        const ex = !wW103IsW(e, -1, 0) ? 2.5 : 29.5;
        for (let i = 0; i < 4; i++) { const p = pEl(ex, fy + i * lh + lh / 2, 2.6, lh / 2 - .3); wFlat(c, p, '#c8a06a', .6); }
      }
      break;
    }
    case 'boards': {
      const bh = fh / 6;
      for (let i = 0; i < 6; i++) { const y = fy + i * bh; c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, y + bh - 1.4, 32, 1.4); wLine(c, [[0, y + bh], [32, y + bh]], .5, 'rgba(70,70,60,.45)'); }
      c.fillStyle = 'rgba(80,110,90,.25)'; c.fillRect(0, 32 - 3, 32, 3); // weed and weather at the foot
      break;
    }
    case 'basalt': {
      const rows = [[fy, fh * .45], [fy + fh * .45, fh * .55]];
      rows.forEach(([y, h], i) => {
        for (let x = -(i * 7); x < 32; x += 13) {
          const p = pPoly([[x + 1, y + 1], [x + 12, y + 1], [x + 12.5, y + h - 1], [x + .5, y + h - 1]]);
          c.fillStyle = tint(st.wall, (wHash(e.x * 3 + x, e.y + i, 64) - .5) * .25); c.fill(p); wStroke(c, p, .6, 'rgba(0,0,0,.7)');
        }
      });
      if (wHash(e.x, e.y, 65) < .55) { c.save(); c.shadowColor = '#ff6a1a'; c.shadowBlur = 4; wLine(c, [[4 + r() * 8, fy + fh * .45], [14 + r() * 10, fy + fh * .45]], 1, st.mortar); c.restore(); }
      break;
    }
    case 'ashlar': {
      const rows = 3, h = fh / rows;
      for (let i = 0; i < rows; i++) {
        const y = fy + i * h, off = (i % 2) * 8;
        for (let x = -off; x < 32; x += 16) { c.fillStyle = tint(st.wall, (wHash(e.x * 2 + x, e.y * 3 + i, 66) - .5) * .16); c.fillRect(x + .6, y + .6, 15, h - 1.2); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + .6, y + .6, 15, 1); }
      }
      c.fillStyle = 'rgba(240,248,255,.75)'; c.fillRect(0, 32 - 3.5, 32, 3.5); // snow banked at the foot
      break;
    }
    case 'marble': {
      for (let x = 2; x < 32; x += 8) { c.fillStyle = tint(st.wall, .06); c.fillRect(x, fy, 4, fh); wLine(c, [[x, fy], [x, 32]], .5, 'rgba(90,80,60,.4)'); wLine(c, [[x + 4, fy], [x + 4, 32]], .5, 'rgba(90,80,60,.4)'); }
      c.fillStyle = st.trim; c.fillRect(0, fy, 32, 1.5);
      break;
    }
  }
}
function wW103Window(c, st, x, y, w, h, f) {
  const p = pRR(x, y, w, h, .8);
  c.fillStyle = f.lit ? '#ffd877' : st.id === 'basalt' ? '#ffb35a' : '#bcd6e2'; c.fill(p);
  if (!f.lit) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 1, y + 1, w * .35, h * .3); }
  wLine(c, [[x + w / 2, y], [x + w / 2, y + h]], .7, WINKC); wLine(c, [[x, y + h / 2], [x + w, y + h / 2]], .7, WINKC);
  wStroke(c, p, 1);
  // shutters
  for (const sx of [x - 3.4, x + w + .4]) { const s = pRR(sx, y, 3, h, .5); wFlat(c, s, st.shutter, .7); wLine(c, [[sx + .5, y + h * .33], [sx + 2.5, y + h * .33]], .4, 'rgba(0,0,0,.4)'); wLine(c, [[sx + .5, y + h * .66], [sx + 2.5, y + h * .66]], .4, 'rgba(0,0,0,.4)'); }
  if (f.box) {
    const b = pRR(x - 2, y + h, w + 4, 3, .6); wFlat(c, b, '#7a5230', .7);
    const cols = ['#f4a6c0', '#f6e27a', '#c94a3a', '#ffffff', '#b38cf0'];
    for (let i = 0; i < 4; i++) { c.fillStyle = cols[(f.seed + i) % cols.length]; c.beginPath(); c.arc(x - .5 + i * (w + 1) / 3, y + h - .6, 1.4, 0, 7); c.fill(); }
  }
}
function wW103Icon(c, icon, x, y) {
  // a small inked pictogram centred on (x, y), about 8px
  c.save(); c.translate(x, y); c.lineWidth = .9; c.strokeStyle = WINKC;
  const F = (p, col) => { c.fillStyle = col; c.fill(p); c.stroke(p); };
  switch (icon) {
    case 'tankard': F(pRR(-3, -3, 5, 6.5, 1), '#e0b84a'); c.fillStyle = '#fff6e0'; c.fillRect(-3, -3.6, 5, 1.6); c.beginPath(); c.arc(2.4, .3, 1.8, -1.4, 1.4); c.stroke(); break;
    case 'purse': { const p = new Path2D(); p.moveTo(-3, -1); p.quadraticCurveTo(-4.5, 4, 0, 4); p.quadraticCurveTo(4.5, 4, 3, -1); p.closePath(); F(p, '#c98a3a'); wLine(c, [[-2, -2.4], [2, -2.4]], 1.1, WINKC); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(0, 1.5, 1, 0, 7); c.fill(); break; }
    case 'anvil': F(pPoly([[-4, -1.5], [4, -1.5], [2, 1], [2, 3], [3, 4], [-3, 4], [-2, 3], [-2, 1]]), '#6a6a72'); wLine(c, [[1, -4.5], [-2.5, -1.8]], 1.4, '#7a5230'); break;
    case 'bell': { const p = new Path2D(); p.moveTo(-3.5, 3); p.quadraticCurveTo(-3, -4, 0, -4); p.quadraticCurveTo(3, -4, 3.5, 3); p.closePath(); F(p, '#e0b84a'); c.beginPath(); c.arc(0, 3.6, 1, 0, 7); c.fillStyle = WINKC; c.fill(); break; }
    case 'ball': { const p = new Path2D(); p.arc(0, 0, 3.8, 0, 7); F(p, '#f4f0e4'); c.beginPath(); c.arc(-4.5, 0, 3, -.8, .8); c.stroke(); c.beginPath(); c.arc(4.5, 0, 3, Math.PI - .8, Math.PI + .8); c.stroke(); break; }
    case 'scroll': F(pRR(-4, -3, 8, 6, 1.5), '#efe3c8'); wLine(c, [[-2, -1], [2.5, -1]], .5, WINKC); wLine(c, [[-2, 1], [2, 1]], .5, WINKC); c.fillStyle = '#c94a3a'; c.beginPath(); c.arc(2.5, 2.8, 1.3, 0, 7); c.fill(); break;
    case 'flask': { const p = new Path2D(); p.moveTo(-1, -4); p.lineTo(1, -4); p.lineTo(1, -1); p.lineTo(3.8, 3.6); p.lineTo(-3.8, 3.6); p.lineTo(-1, -1); p.closePath(); F(p, '#bcd6e2'); c.fillStyle = '#5dbb63'; c.fillRect(-2.8, 1.5, 5.6, 1.8); break; }
    case 'bowl': { const p = new Path2D(); p.moveTo(-4, -.5); p.quadraticCurveTo(0, 6, 4, -.5); p.closePath(); F(p, '#c98a3a'); wLine(c, [[-1, -1.5], [-.5, -4.5]], .7, 'rgba(120,120,120,.8)'); wLine(c, [[1.5, -1.5], [2, -4]], .7, 'rgba(120,120,120,.8)'); break; }
    case 'crate': F(pRR(-3.5, -3.5, 7, 7, .5), '#b4875a'); wLine(c, [[-3.5, -3.5], [3.5, 3.5]], .6, WINKC); wLine(c, [[3.5, -3.5], [-3.5, 3.5]], .6, WINKC); break;
    case 'lamp': F(pRR(-2, -3, 4, 6, 1), '#ffd877'); wLine(c, [[0, -3], [0, -4.5]], .8, WINKC); break;
    case 'bee': { F(pEl(0, 0, 3.6, 2.4), '#f2c14e'); wLine(c, [[-1, -2.2], [-1, 2.2]], .9, WINKC); wLine(c, [[1.2, -2.2], [1.2, 2.2]], .9, WINKC); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(-.5, -3.2, 1.8, 1.2, -.4, 0, 7); c.fill(); break; }
  }
  c.restore();
}
function wW103Feature(c, st, e, f, fy, front) {
  const S = wFacadeSeed(e);
  if (f.k === 'chimney') {
    // a stack on the roof, smoke going up into the row above (within WTALL)
    const p = pRR(18, -10, 7, 18, .6); wCel(c, p, st.id === 'basalt' ? '#4a4246' : st.id === 'bark' ? '#8a8378' : '#9a5a44', 1, 1);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(18, -10, 7, 2.2); wStroke(c, pRR(17, -11, 9, 2.6, .5), .8);
    for (let i = 0; i < 3; i++) { c.fillStyle = f.hot ? `rgba(80,70,70,${.35 - i * .08})` : `rgba(230,230,235,${.5 - i * .12})`; c.beginPath(); c.arc(21.5 + i * 2.5 + Math.sin(i + e.x) * 1.5, -14 - i * 3, 2.4 + i * .8, 0, 7); c.fill(); }
    if (f.hot) { c.fillStyle = '#ffb35a'; c.fillRect(20, -10.5, 3, 1); }
    return;
  }
  if (f.k === 'flagpole') {
    wLine(c, [[16, 8], [16, -18]], 1.1);
    const fl = pPoly([[16, -18], [26, -15.5], [16, -12.5]]); wFlat(c, fl, (wMapPal(e.m) || {}).accent || '#c94a3a', .8);
    return;
  }
  if (f.k === 'sign' && f.cap) { // a north door: the board hangs off the roof edge
    wLine(c, [[6, 20], [26, 20]], 1.3, '#3a2a1a'); wLine(c, [[9, 20], [9, 23]], .7); wLine(c, [[23, 20], [23, 23]], .7);
    const bd = pRR(7, 23, 18, 9, 1.2); wCel(c, bd, st.trim, .8, 1); wW103Icon(c, f.icon, 16, 27.5); return;
  }
  if (!front) return;
  const ww = 8, wy = fy + 4, wx = 12;
  if (f.awn) {
    const a = new Path2D(); a.moveTo(-1, fy + 1); a.lineTo(33, fy + 1); a.lineTo(33, fy + 6); for (let x = 33; x >= -1; x -= 4.25) a.quadraticCurveTo(x - 2.1, fy + 9, x - 4.25, fy + 6); a.closePath();
    c.save(); c.clip(a); for (let x = -1; x < 33; x += 8.5) { c.fillStyle = st.awn[0]; c.fillRect(x, fy, 4.25, 10); c.fillStyle = st.awn[1]; c.fillRect(x + 4.25, fy, 4.25, 10); } c.restore();
    wStroke(c, a, .9);
  }
  switch (f.k) {
    case 'win': wW103Window(c, st, wx, f.awn ? wy + 4 : wy, ww, f.tall ? 11 : 8, { lit: f.lit, box: f.box, seed: S }); break;
    case 'stained': {
      const p = new Path2D(); p.moveTo(11, 31 - 1); p.lineTo(11, fy + 7); p.quadraticCurveTo(16, fy + 1, 21, fy + 7); p.lineTo(21, 30); p.closePath();
      const cols = ['#c94a3a', '#3f7d9a', '#e0b84a', '#5dbb63', '#b38cf0'];
      c.save(); c.clip(p); for (let i = 0; i < 6; i++) { c.fillStyle = cols[(S + i) % cols.length]; c.fillRect(11 + (i % 2) * 5, fy + Math.floor(i / 2) * 6, 5, 6); } c.restore();
      wStroke(c, p, 1.1); wLine(c, [[16, fy + 3], [16, 30]], .6, WINKC); break;
    }
    case 'pennant': {
      const col = (wMapPal(e.m) || {}).accent || '#c94a3a';
      wLine(c, [[8, fy + 1], [24, fy + 1]], 1.2, '#3a2a1a');
      const p = pPoly([[10, fy + 1], [22, fy + 1], [22, fy + 13], [16, fy + 17], [10, fy + 13]]); wCel(c, p, col, .8, 1);
      c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(16, fy + 8, 2.4, 0, 7); c.fill(); break;
    }
    case 'vent': { const p = pRR(11, fy + 6, 10, 7, 1); wFlat(c, p, '#2a2024', .8); c.save(); c.shadowColor = '#ff6a1a'; c.shadowBlur = 5; c.fillStyle = '#ff8a3c'; for (let i = 0; i < 3; i++) c.fillRect(12.5 + i * 3, fy + 8, 1.5, 3.5); c.restore(); break; }
    case 'soot': c.fillStyle = 'rgba(20,15,15,.3)'; c.beginPath(); c.ellipse(16, fy + 2, 14, 7, 0, 0, Math.PI); c.fill(); break;
    case 'bay': if (f.i === 2) { const p = pRR(5, fy + 3, 22, 32 - fy - 3, 1); wFlat(c, p, '#8a6a42', 1); wLine(c, [[16, fy + 3], [16, 32]], .8); wLine(c, [[5, fy + 3], [27, 31]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[27, fy + 3], [5, 31]], .6, 'rgba(29,20,15,.5)'); } else wW103Window(c, st, wx, wy, ww, 6, {}); break;
    case 'slit': { const p = pRR(14.5, fy + 4, 3, 10, 1.5); c.fillStyle = '#ffd877'; c.fill(p); wStroke(c, p, .8); break; }
    case 'lamp': { wLine(c, [[16, fy + 2], [16, fy + 5]], .9); const p = pRR(13, fy + 5, 6, 8, 1.5); wFlat(c, p, '#ffd877', 1); c.fillStyle = '#3a2a1a'; c.fillRect(12.5, fy + 4.5, 7, 1.5); break; }
    case 'sign': {
      // an iron bracket off the wall and a board on two chains
      wLine(c, [[4, fy + 2], [28, fy + 2]], 1.4, '#3a2a1a'); wLine(c, [[4, fy + 2], [10, fy - 2]], .9, '#3a2a1a');
      wLine(c, [[9, fy + 2], [9, fy + 5]], .6); wLine(c, [[23, fy + 2], [23, fy + 5]], .6);
      const bd = pRR(6, fy + 5, 20, 12, 1.5); wCel(c, bd, st.trim, .8, 1.1);
      wW103Icon(c, f.icon, 16, fy + 11); break;
    }
  }
}
function wFacadeSeed(e) { return (wHash(e.x, e.y, 67) * 997) | 0; }
function wStyledWall(c, P, e, st) {
  const front = !wW103IsW(e, 0, 1), capH = front ? 13 : 32;
  wStyledCap(c, st, e, capH, front);
  const fy = capH;
  if (front) {
    wStyledFace(c, st, e, fy, 32 - fy);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 32 - 2.5, 32, 2.5);
    wLine(c, [[0, fy], [32, fy]], 1, 'rgba(29,20,15,.75)');
    wLine(c, [[0, 32], [32, 32]], 1.5);
  }
  c.lineWidth = 1.5; c.strokeStyle = WINKC; c.beginPath();
  if (!wW103IsW(e, 0, -1)) { c.moveTo(0, .5); c.lineTo(32, .5); }
  if (!wW103IsW(e, -1, 0)) { c.moveTo(.5, 0); c.lineTo(.5, 32); }
  if (!wW103IsW(e, 1, 0)) { c.moveTo(31.5, 0); c.lineTo(31.5, 32); }
  c.stroke();
  const f = e.m.fac && e.m.fac[e.x + ',' + e.y];
  if (f && f.k !== 'door') wW103Feature(c, st, e, f, fy, front);
  return front;
}
const wW103WallFace = wWallFace;
wWallFace = function (c, P, e, kind) {
  const st = kind === '#' && wStyleOf(e.m);
  if (!st) return wW103WallFace(c, P, e, kind);
  return wStyledWall(c, P, e, st);
};
// doors in the style's colours, one per building
WOBJ['+'] = (c, P, r, e) => {
  wWallFace(c, P, e, '#');
  const st = wStyleOf(e.m), f = e.m.fac && e.m.fac[e.x + ',' + e.y];
  const col = st ? st.door[((f && f.col) || 0) % st.door.length] : '#8a5f32';
  const p = new Path2D(); p.moveTo(8, 32); p.lineTo(8, 12); p.quadraticCurveTo(16, 4, 24, 12); p.lineTo(24, 32); p.closePath();
  if (st) { const fr = new Path2D(); fr.moveTo(6, 32); fr.lineTo(6, 11); fr.quadraticCurveTo(16, 1.5, 26, 11); fr.lineTo(26, 32); fr.closePath(); wFlat(c, fr, st.trim, 1); }
  wCel(c, p, col, 1.2, 1.3);
  wLine(c, [[12, 12], [12, 32]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[16, 9], [16, 32]], .6, 'rgba(29,20,15,.5)'); wLine(c, [[20, 12], [20, 32]], .6, 'rgba(29,20,15,.5)');
  c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(21.5, 22, 1.2, 0, 7); c.fill();
  if (st && f && f.kind === 'home') { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(16, 12.5, 2.2, 0, 7); c.fill(); wStroke(c, (() => { const q = new Path2D(); q.arc(16, 12.5, 2.2, 0, 7); return q; })(), .6); }
};

/* ---------- landmarks and street life ---------- */
Object.assign(DB.tiles, {
  'æ': { name: 'the Charter Clock', walk: 0, use: 'feature', look: 'The Charter Clock, on a column of red brick. It has kept League time since the first season, and it is never wrong by more than a match.' },
  'ø': { name: 'wishing well', walk: 0, use: 'feature', look: 'A wishing well, its bottom silver with a hundred years of coins. A coin buys a wish, and somebody always answers.' },
  'ð': { name: 'mushroom ring', walk: 0, use: 'feature', look: 'A ring of tall grey mushrooms. Players say a rest inside it takes the ache out of anything.', look0: 'The mushrooms have closed their caps. Come back tomorrow.' },
  'þ': { name: 'fishing spot', walk: 0, use: 'feature', look: 'The end of the pier, where the deep water starts. A rod and a bucket are left out for anyone.', look0: 'The fish have learned your face. Tomorrow.' },
  'ß': { name: 'lobster pots', walk: 0, look: 'Lobster pots of willow and tar, stacked and stinking. One of them is tapping.' },
  'ñ': { name: 'the forge stack', walk: 0, use: 'feature', look: 'The great forge stack, hot to the touch three paces off. Miners and players warm their legs on its benches.', look0: 'The benches are full of miners. Try tomorrow.' },
  'ü': { name: 'ore cart', walk: 0, look: 'An ore cart on a stub of rail, half full of glittering slag. Somebody has chalked a team name on the side.' },
  'é': { name: 'ice statue', walk: 0, use: 'feature', look: 'An ice statue of the reigning champion, re-carved every year by the abbey\'s novices.' },
  'ö': { name: 'snowman', walk: 0, look: 'A snowman in a scarf of the Frostspire colours, with a puck for a nose.' },
  'å': { name: 'washing line', walk: 0, look: 'A washing line, heavy with jerseys. Nobody has asked whose.' },
  'ï': { name: 'haystack', walk: 0, look: 'A haystack. Something small is asleep in it and snoring.' },
});
// each landmark: where it wants to stand, what it can stand on
const W_LANDMARKS = {
  graftonbury: [['æ', 26, 9], ['ø', 43, 14], ['å', 17, 26], ['ï', 6, 30], ['ï', 9, 31]],
  mossgate: [['ð', 36, 12], ['ï', 25, 29], ['å', 14, 24]],
  saltmere: [['þ', 11, 33, ['~']], ['þ', 33, 33, ['~']], ['ß', 9, 30, ['~']], ['ß', 34, 31, ['~']], ['å', 4, 24]],
  cinderhold: [['ñ', 26, 19], ['ü', 36, 13], ['ü', 37, 14]],
  rimewatch: [['é', 16, 11], ['ö', 5, 27], ['ö', 28, 27], ['ö', 26, 12]],
};
// the nearest tile to (x, y) that is open ground, keeps the town's reach, and has somewhere to stand beside it
function wPutNear(m, ch, x, y, on, meta) {
  const gc = on;
  const reach = bfsReach(m, m.spawn[0], m.spawn[1]); let base = 0; for (let i = 0; i < reach.length; i++) base += reach[i];
  const nearDoor = (xx, yy) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.t[yy + dy] && m.t[yy + dy][xx + dx] === '+');
  for (let rad = 0; rad <= 5; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const xx = x + dx, yy = y + dy;
    if (xx < 1 || yy < 1 || xx >= m.w - 1 || yy >= m.h) continue;
    const c0 = m.t[yy][xx];
    if (!gc.includes(c0) || m.meta[xx + ',' + yy] || nearDoor(xx, yy) || m.npcs.some(n => n.x === xx && n.y === yy) || wInsideBuilding(m, xx, yy)) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => yy + ay < m.h && reach[(yy + ay) * m.w + xx + ax] && walkCh(m.t[yy + ay][xx + ax]))) continue;
    m.t[yy][xx] = ch;
    const r2 = bfsReach(m, m.spawn[0], m.spawn[1]); let n = 0; for (let i = 0; i < r2.length; i++) n += r2[i];
    if (n >= base - (walkCh(c0) && reach[yy * m.w + xx] ? 1 : 0)) { m.meta[xx + ',' + yy] = Object.assign({ under: c0 === '~' ? '~' : c0 }, meta || {}); return [xx, yy]; }
    m.t[yy][xx] = c0;
  }
  return null;
}
function wGroundCh(m) { const d = DB.towns.find(t => t.id === m.id); return (d && d.ground) || '.'; }
function wPlaceLandmarks() {
  for (const id in W_LANDMARKS) {
    const m = MAPS[id]; if (!m) continue;
    for (const [ch, x, y, on] of W_LANDMARKS[id]) wPutNear(m, ch, x, y, on || [wGroundCh(m)], { feature: ch });
  }
}

/* the once-a-day features: their uses, and how a used one looks */
const W_FEATURE = {
  'ð': { days: 1, use: (x, y) => { const h = wCampHeal(.15); wAdvance(30); return 'You lie back inside the mushroom ring for half an hour. The team gets up lighter' + (h ? ' (+' + h + ' HP).' : ', though nobody was hurt.'); } },
  'þ': { days: 1, use: (x, y) => { const fish = Math.random() < .6, it = fish ? 'saltfish' : 'brinekelp', n = ri(1, 2); if (DB.items[it]) wAddItem(it, n); wAdvance(45); return fish ? 'You fish off the pier end for most of an hour, and land ' + n + ' ' + DB.items[it].name + '.' : 'The fish are not biting, but the line comes up wrapped in ' + n + ' ' + DB.items[it].name + '.'; } },
  'ñ': { days: 1, use: (x, y) => { if (typeof wRestLegs === 'function') wRestLegs(1); wAdvance(30); return 'The team sits on the forge benches with their boots off for half an hour. Tired legs ease.'; } },
};
const W_FORTUNES = ['A coin goes down. Somewhere below, something says: "Play the long ball."', 'The coin rings on the others. You feel a cup coming, though maybe not this year.', 'Splash. A voice in the well: "Your keeper should drink more water." It is probably right.', 'The coin spins a long time before it sinks. Lucky, the old women say.', 'Down it goes. A frog surfaces, looks at you, and goes back down unimpressed.'];
function wFeatureUse(x, y) {
  const m = wCurMap(), ch = wTileAt(m, x, y), F = W_FEATURE[ch];
  if (F) {
    if (wDepleted(x, y, F.days)) return wLog(DB.tiles[ch].look0 || DB.tiles[ch].look, 'd');
    WG.harv[wHkey(x, y)] = WG.dayAbs; wLog(F.use(x, y), 'm'); wInvalidate(WG.map); return;
  }
  if (ch === 'æ') {
    const d = wDaysToChamp();
    return wLog('The Charter Clock says ' + wTimeStr() + ', ' + wSeason().toLowerCase() + ', day ' + WG.day + ' of year ' + WG.year + '. ' + (wChampWeek() ? 'Championship week: the Crown is being played for now.' : d + ' day' + (d === 1 ? '' : 's') + ' to championship week at the Crown.'), 'g');
  }
  if (ch === 'ø') {
    if ((RUN.gold || 0) < 1) return wLog('You have no coin to wish with.', 'd');
    RUN.gold -= 1; return wLog(pick(W_FORTUNES), 'g');
  }
  if (ch === 'é') {
    if (wFlag('champion')) return wLog('The statue is of your team, holding the crown up. The novices have got your captain\'s nose wrong, and they will not be told.', 'g');
    return wLog('The statue is of last year\'s champions, the Apex, crown held high. There is a smooth block beside it, waiting for the next one.', 'd');
  }
  wLog(wLookText(x, y), 'd');
}
const wW103Use = wUse;
wUse = function (x, y) {
  const m = wCurMap(), c = wTileAt(m, x, y);
  if ((DB.tiles[c] || {}).use === 'feature') return wFeatureUse(x, y);
  return wW103Use(x, y);
};
const wW103TileVariant = wTileVariant;
wTileVariant = function (map, x, y, c) {
  if (W_FEATURE[c] && WG) return wDepleted(x, y, W_FEATURE[c].days, map.id) ? '0' : '1';
  return wW103TileVariant(map, x, y, c);
};

/* ---------- drawing the landmarks ---------- */
Object.assign(WOBJ, {
  'æ': (c, P, r) => { // a brick column with a clock face, reaching up into the row above
    wShadow(c, 16, 30, 9, 3, .35);
    const col = pRR(10, -14, 12, 44, 1); wCel(c, col, '#a9533c', 1, 1.2);
    for (let y = -10; y < 30; y += 4) wLine(c, [[10, y], [22, y]], .4, 'rgba(60,20,10,.4)');
    const cap = pPoly([[8, -14], [16, -21], [24, -14]]); wCel(c, cap, '#56697f', 1, 1.1);
    const face = new Path2D(); face.arc(16, -5, 5.5, 0, 7); wFlat(c, face, '#f4ead2', 1.1);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = WINKC; c.fillRect(16 + Math.cos(a) * 4.4 - .4, -5 + Math.sin(a) * 4.4 - .4, .8, .8); }
    wLine(c, [[16, -5], [16, -8.6]], .9); wLine(c, [[16, -5], [18.6, -4]], .9);
    const base = pRR(7, 25, 18, 6, 1); wCel(c, base, '#8a857e', 1, 1);
  },
  'ø': (c, P, r) => {
    wShadow(c, 16, 28, 13, 3.5, .3);
    const wall = new Path2D(); wall.ellipse(16, 22, 11, 6, 0, 0, Math.PI * 2); wCel(c, wall, '#a8a398', 1, 1.2);
    const hole = new Path2D(); hole.ellipse(16, 21, 7.5, 3.6, 0, 0, Math.PI * 2); c.fillStyle = '#2a4a5a'; c.fill(hole); wStroke(c, hole, .8);
    c.fillStyle = '#e0e8e8'; c.fillRect(13, 20.5, 1, 1); c.fillRect(18, 21.5, 1, 1);
    wLine(c, [[6, 22], [6, 4]], 1.6, '#6a4a2a'); wLine(c, [[26, 22], [26, 4]], 1.6, '#6a4a2a');
    const roof = pPoly([[3, 6], [16, -3], [29, 6]]); wCel(c, roof, '#56697f', 1, 1.1);
    wLine(c, [[6, 9], [26, 9]], 1, '#6a4a2a'); wLine(c, [[16, 9], [16, 15]], .6, '#3a2a1a'); wFlat(c, pRR(14, 15, 4, 3, .5), '#7a5230', .6);
  },
  'ð': (c, P, r, e, v) => {
    const shut = String(v) === '0';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, x = 16 + Math.cos(a) * 12, y = 18 + Math.sin(a) * 8;
      wShadow(c, x, y + 1.5, 3, 1, .25); wLine(c, [[x, y + 1], [x, y - 4]], 1.6, '#e8e0cc');
      const cap = shut ? pEl(x, y - 4.5, 2, 2.6) : pEl(x, y - 4.5, 3.6, 2.2); wCel(c, cap, i % 3 ? '#9a8a9a' : '#c94a3a', .6, .9);
      if (!shut && i % 3 === 0) { c.fillStyle = '#fff'; c.fillRect(x - 1.5, y - 5.5, 1, 1); c.fillRect(x + 1, y - 4.8, 1, 1); }
    }
    c.fillStyle = 'rgba(200,240,140,.25)'; c.beginPath(); c.ellipse(16, 18, 8, 5, 0, 0, Math.PI * 2); c.fill();
  },
  'þ': (c, P, r) => {
    const p = pRR(2, 6, 28, 20, 1.5); wCel(c, p, '#b4875a', .8, 1.1);
    for (let y = 10; y < 26; y += 4) wLine(c, [[2, y], [30, y]], .5, 'rgba(29,20,15,.5)');
    wLine(c, [[8, 20], [24, -6]], 1.1, '#5a3a1a');
    c.save(); c.setLineDash([1.5, 1.5]); wLine(c, [[24, -6], [28, 30]], .5, 'rgba(29,20,15,.7)'); c.restore();
    const b = pRR(19, 14, 7, 7, 1); wCel(c, b, '#8a8f96', .8, .9); c.fillStyle = '#c0c8d0'; c.fillRect(20.5, 15.5, 4, 1.3);
  },
  'ß': (c, P, r) => {
    for (const [x, y] of [[6, 18], [16, 22], [24, 16]]) { const p = pRR(x - 5, y - 6, 10, 8, 3); wCel(c, p, '#8a6a3a', .8, 1); for (let i = -3; i <= 3; i += 2) wLine(c, [[x + i, y - 6], [x + i, y + 2]], .5, 'rgba(29,20,15,.6)'); }
    wLine(c, [[16, 22], [16, 30]], .6, 'rgba(240,240,220,.8)');
    c.fillStyle = '#c94a3a'; c.beginPath(); c.arc(16, 30, 1.6, 0, 7); c.fill();
  },
  'ñ': (c, P, r) => {
    wShadow(c, 16, 30, 14, 3, .35);
    const st = pPoly([[8, 30], [10, -16], [22, -16], [24, 30]]); wCel(c, st, '#3b3437', 1, 1.3);
    for (let y = -12; y < 30; y += 5) wLine(c, [[9.5, y], [22.5, y]], .5, 'rgba(255,140,60,.35)');
    const mouth = pRR(11, 18, 10, 9, 3); c.fillStyle = '#ff8a3c'; c.fill(mouth); c.save(); c.shadowColor = '#ff6a1a'; c.shadowBlur = 6; c.fillStyle = '#ffd36b'; c.fillRect(13, 21, 6, 5); c.restore(); wStroke(c, mouth, 1);
    for (const x of [1, 25]) { const b = pRR(x, 24, 6, 3, .5); wFlat(c, b, '#7a5230', .7); }
    for (let i = 0; i < 2; i++) { c.fillStyle = `rgba(70,60,60,${.4 - i * .15})`; c.beginPath(); c.arc(16 + i * 3, -18 - i * 3, 3 + i, 0, 7); c.fill(); }
  },
  'ü': (c, P, r) => {
    wLine(c, [[0, 27], [32, 27]], 1.2, '#4a4a4a'); wLine(c, [[0, 30], [32, 30]], 1.2, '#4a4a4a');
    for (let x = 2; x < 32; x += 6) wLine(c, [[x, 26], [x, 31]], 1.5, '#6a4a2a');
    const body = pPoly([[6, 12], [26, 12], [24, 25], [8, 25]]); wCel(c, body, '#6a6a72', 1, 1.2);
    c.fillStyle = '#2a2024'; c.beginPath(); c.ellipse(16, 12, 10, 2.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb35a'; for (let i = 0; i < 4; i++) c.fillRect(10 + i * 3.5, 10.5, 1.4, 1.4);
    for (const x of [10, 22]) { const w = new Path2D(); w.arc(x, 26, 2.6, 0, 7); wFlat(c, w, '#3a3a40', .8); }
  },
  'é': (c, P, r) => {
    wShadow(c, 16, 30, 11, 3, .3);
    const base = pRR(6, 24, 20, 7, 1); wCel(c, base, '#c8c5be', 1, 1.1);
    const fig = new Path2D(); fig.moveTo(11, 24); fig.lineTo(12, 8); fig.quadraticCurveTo(16, 4, 20, 8); fig.lineTo(21, 24); fig.closePath();
    c.save(); c.globalAlpha = .9; wCel(c, fig, '#cfeaf4', 1, 1.1); c.restore();
    const head = new Path2D(); head.arc(16, 3, 3.6, 0, 7); wCel(c, head, '#dff2f8', .8, 1);
    wLine(c, [[20, 9], [25, -4]], 1.6, '#cfeaf4'); const crown = pPoly([[22, -5], [23, -9], [24.5, -6.5], [26, -9.5], [27, -5]]); wFlat(c, crown, '#f2c14e', .8);
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(13, 10, 1.2, 8);
  },
  'ö': (c, P, r) => {
    wShadow(c, 16, 29, 9, 3, .25);
    const b1 = new Path2D(); b1.arc(16, 23, 7.5, 0, 7); wCel(c, b1, '#f4f8fa', 1, 1.1);
    const b2 = new Path2D(); b2.arc(16, 12, 5.2, 0, 7); wCel(c, b2, '#f4f8fa', 1, 1.1);
    c.fillStyle = '#4a6a9a'; c.fillRect(10.5, 15.5, 11, 2.6); c.fillRect(18, 16, 2.6, 6);
    c.fillStyle = WINKC; c.fillRect(13.6, 10.5, 1.2, 1.2); c.fillRect(17.2, 10.5, 1.2, 1.2); c.fillRect(15.4, 12.4, 1.6, 1.2);
  },
  'å': (c, P, r) => {
    wLine(c, [[2, 30], [2, 6]], 1.4, '#6a4a2a'); wLine(c, [[30, 30], [30, 6]], 1.4, '#6a4a2a');
    const sag = new Path2D(); sag.moveTo(2, 7); sag.quadraticCurveTo(16, 12, 30, 7); c.lineWidth = .6; c.strokeStyle = WINKC; c.stroke(sag);
    const cols = ['#c94a3a', '#3f5aa8', '#f2c14e', '#efe3c8'];
    for (let i = 0; i < 3; i++) { const x = 6 + i * 8, y = 9 + Math.sin((i + 1) / 4 * Math.PI) * 2; const j = pPoly([[x - 3, y], [x + 3, y], [x + 4, y + 2], [x + 2.5, y + 2], [x + 2.5, y + 8], [x - 2.5, y + 8], [x - 2.5, y + 2], [x - 4, y + 2]]); wFlat(c, j, cols[(i + (r() * 4 | 0)) % 4], .7); }
  },
  'ï': (c, P, r) => {
    wShadow(c, 16, 29, 13, 3, .3);
    const h = new Path2D(); h.moveTo(3, 29); h.quadraticCurveTo(4, 8, 16, 6); h.quadraticCurveTo(28, 8, 29, 29); h.closePath(); wCel(c, h, '#d8b860', 1.2, 1.2);
    for (let i = 0; i < 14; i++) { const x = 6 + r() * 20, y = 10 + r() * 17; wLine(c, [[x, y], [x + (r() - .5) * 4, y + 3]], .6, 'rgba(120,90,30,.6)'); }
  },
});
Object.assign(W_MAP_COL, { 'æ': '#a9533c', 'ø': '#8a857e', 'ð': '#9a8a9a', 'þ': '#b4875a', 'ß': '#8a6a3a', 'ñ': '#3b3437', 'ü': '#6a6a72', 'é': '#cfeaf4', 'ö': '#f4f8fa', 'å': '#c94a3a', 'ï': '#d8b860' });

/* ---------- the world map: each city's own icon, each dungeon's own door ---------- */
function wW103LocAt(e) { const mt = wMeta(e.m, e.x, e.y); return mt && mt.loc; }
const wW103TownIcon = WOBJ.O;
WOBJ.O = (c, P, r, e) => {
  const id = e && wW103LocAt(e);
  const H = (x, y, w, h, roof, ch) => wHouse(c, x, y, w, h, roof, P, r, ch);
  switch (id) {
    case 'graftonbury':
      wShadow(c, 17, 28, 16, 4, .3); H(1, 14, 10, 9, '#56697f', true); H(21, 13, 10, 9, '#b5523a', true);
      { const sp = pRR(12.5, 0, 7, 26, .5); wCel(c, sp, '#a9533c', 1, 1.2); const tip = pPoly([[11, 1], [16, -9], [21, 1]]); wCel(c, tip, '#56697f', 1, 1.1); const f = new Path2D(); f.arc(16, 6, 2.4, 0, 7); wFlat(c, f, '#f4ead2', .7); }
      H(7, 22, 18, 8, '#c98a3a', false); return;
    case 'mossgate':
      wShadow(c, 17, 28, 16, 4, .3); wTree(c, P, r, 9, 24, 1.15); wTree(c, P, r, 24, 22, 1.05);
      H(4, 14, 9, 7, '#a08a3e', false); H(19, 10, 9, 7, '#a08a3e', true); wLine(c, [[13, 18], [19, 15]], .9, '#6a4a2a'); H(10, 23, 12, 7, '#7a5636', true); return;
    case 'saltmere':
      wShadow(c, 17, 28, 16, 4, .3); H(2, 17, 11, 9, '#b5523a', true); H(14, 21, 10, 8, '#3f7d9a', false);
      { const t = pPoly([[24, 28], [25.5, 2], [29.5, 2], [31, 28]]); wCel(c, t, '#ece6d6', 1, 1.2); c.fillStyle = '#c94a3a'; c.fillRect(24.6, 10, 6, 3); c.fillRect(24.3, 18, 6.6, 3); const lamp = pRR(24.5, -3, 6, 5, 1); wFlat(c, lamp, '#ffd877', 1); const cap = pPoly([[23.5, -3], [27.5, -7], [31.5, -3]]); wFlat(c, cap, '#b5523a', .9); }
      return;
    case 'cinderhold':
      wShadow(c, 17, 28, 16, 4, .3); H(2, 15, 11, 9, '#5f5d63', true); H(15, 18, 11, 9, '#5f5d63', false);
      for (const x of [23, 28]) { const ch = pRR(x, -2, 3.6, 20, .4); wFlat(c, ch, '#3b3437', 1); c.fillStyle = '#ff8a3c'; c.fillRect(x + .6, -2.6, 2.4, 1.2); c.fillStyle = 'rgba(80,70,70,.5)'; c.beginPath(); c.arc(x + 2, -6, 2.4, 0, 7); c.fill(); }
      H(6, 23, 14, 7, '#3b3437', true); return;
    case 'rimewatch':
      wShadow(c, 17, 28, 16, 4, .3); H(2, 14, 11, 9, '#f4f8fa', true); H(18, 16, 11, 9, '#f4f8fa', false);
      { const tw = pRR(12, 1, 6, 22, .5); wCel(c, tw, '#c8c5be', 1, 1.2); const tip = pPoly([[10.5, 2], [15, -7], [19.5, 2]]); wCel(c, tip, '#f4f8fa', 1, 1.1); c.fillStyle = '#ffd877'; c.fillRect(13.8, 6, 2.4, 3); }
      H(7, 23, 16, 7, '#f4f8fa', true); return;
  }
  return wW103TownIcon(c, P, r, e);
};
const wW103DoorIcon = WOBJ.D;
WOBJ.D = (c, P, r, e) => {
  const id = e && wW103LocAt(e);
  switch (id) {
    case 'genevault': { // a sealed slab door in a dressed-stone face, a rune band across it
      wShadow(c, 16, 30, 15, 3, .35);
      const face = pRR(2, 6, 28, 25, 2); wCel(c, face, '#8a8f9a', 1.2, 1.3);
      for (let y = 12; y < 31; y += 6) wLine(c, [[2, y], [30, y]], .5, 'rgba(29,20,15,.4)');
      const slab = pRR(9, 12, 14, 19, 1); wCel(c, slab, '#4f5262', 1, 1.2);
      c.save(); c.shadowColor = '#b38cf0'; c.shadowBlur = 5; wLine(c, [[11, 20], [21, 20]], 1.4, '#d8c0ff'); c.restore();
      c.fillStyle = '#2a1f3a'; c.fillRect(15, 23, 2, 4); return;
    }
    case 'emberdeep': { // a burrow in scorched rock, glowing from inside
      const m = wBlob(16, 22, 15, 11, r, 9); wCel(c, m, '#5a4a44', 1.8, 1.35);
      const mouth = new Path2D(); mouth.ellipse(16, 26, 8, 6, 0, Math.PI, 0); mouth.lineTo(24, 31); mouth.lineTo(8, 31); mouth.closePath();
      c.fillStyle = '#3a1208'; c.fill(mouth); c.save(); c.clip(mouth); const g = c.createRadialGradient(16, 31, 1, 16, 31, 9); g.addColorStop(0, '#ffb35a'); g.addColorStop(1, 'rgba(255,90,30,0)'); c.fillStyle = g; c.fillRect(6, 18, 20, 14); c.restore(); wStroke(c, mouth, 1.3);
      for (const [x, y] of [[6, 14], [26, 15], [19, 9]]) { c.fillStyle = '#ff8a3c'; c.fillRect(x, y, 1.6, 1.6); } return;
    }
    case 'hatchery': { // a flooded arch, steps going down into water
      const m = wBlob(16, 22, 15, 11, r, 9); wCel(c, m, '#7a8a8a', 1.8, 1.35);
      const arch = new Path2D(); arch.moveTo(8, 31); arch.lineTo(8, 20); arch.quadraticCurveTo(16, 9, 24, 20); arch.lineTo(24, 31); arch.closePath();
      c.fillStyle = '#0a1a24'; c.fill(arch); c.save(); c.clip(arch); c.fillStyle = '#2f6a8a'; c.fillRect(8, 25, 16, 7); c.fillStyle = 'rgba(200,240,255,.6)'; c.fillRect(10, 25.5, 6, .8); c.fillStyle = '#8a9a9a'; c.fillRect(9, 21, 14, 1.4); c.fillRect(9, 23.4, 14, 1.4); c.restore(); wStroke(c, arch, 1.3);
      for (const [x, y] of [[5, 20], [27, 22]]) { wLine(c, [[x, 30], [x + 1, y]], 1.2, '#3f7a3a'); } return;
    }
    case 'deepseam': { // a timber headframe over a shaft
      const m = wBlob(16, 25, 15, 7, r, 9); wCel(c, m, '#6a5a52', 1.4, 1.3);
      const sh = pRR(10, 21, 12, 9, 1); c.fillStyle = '#07060c'; c.fill(sh); wStroke(c, sh, 1.1);
      wLine(c, [[7, 30], [14, -4]], 1.6, '#6a4a2a'); wLine(c, [[25, 30], [18, -4]], 1.6, '#6a4a2a'); wLine(c, [[9, 18], [23, 18]], 1.3, '#6a4a2a'); wLine(c, [[11, 9], [21, 9]], 1.3, '#6a4a2a');
      const wh = new Path2D(); wh.arc(16, -3, 3.4, 0, 7); wFlat(c, wh, '#8a8f96', 1); wLine(c, [[16, -3], [16, 21]], .5, WINKC);
      c.fillStyle = '#3fd0c0'; c.fillRect(4, 25, 1.6, 1.6); c.fillRect(26, 27, 1.6, 1.6); return;
    }
  }
  return wW103DoorIcon(c, P, r, e);
};

/* ---------- after the maps are built ---------- */
function wPlacesBuild() {
  for (const m of Object.values(MAPS)) {
    if (m.kind !== 'town') continue;
    delete m._wsty;
    let def = DB.towns.find(t => t.id === m.id);
    if (!def && typeof wGrd === 'function' && wGrd(m.id) && typeof wGrdDef === 'function') { try { def = wGrdDef(wGrd(m.id)); } catch (e) { def = null; } }
    wFacadePlan(m, def);
  }
  wPlaceLandmarks();
}
const wW103BuildAllMaps = buildAllMaps;
buildAllMaps = function () {
  const r = wW103BuildAllMaps.apply(this, arguments);
  wPlacesBuild();
  if (typeof wDelvesBuild === 'function') wDelvesBuild();
  if (typeof wInvalidate === 'function') wInvalidate();
  return r;
};

/* ---------- How to play ---------- */
const wW103RenderHelp = renderHelp;
renderHelp = function () {
  wW103RenderHelp();
  const h = $('wHelp'); if (!h || $('wHelpPlaces')) return;
  h.insertAdjacentHTML('beforeend', `<p class="hint" id="wHelpPlaces"><b>Places.</b> Each city builds in its own stone: Graftonbury in brick and slate, Mossgate in log and thatch, Saltmere in white boards and red tile, Cinderhold in black basalt, Rimewatch in pale stone under snow. A building's front says what it is: a tankard over an inn, a purse over a shop, an anvil over the smithy, a bell over a chapel, a ball over an arena. Every city has a landmark worth walking up to: Graftonbury's Charter Clock and wishing well, Mossgate's mushroom ring (rest, once a day), Saltmere's pier-end fishing spot (once a day), Cinderhold's forge stack (warm tired legs, once a day) and Rimewatch's ice statue of the champion.</p>`);
};
