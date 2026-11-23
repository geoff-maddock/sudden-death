# Realm: the dark land (issue #111, phase B). On a dark map the tiles keep their characters but are drawn and described
# as the dark side's: grass as ash, water and fen as black ichor, trees dead, snow bone-grey, sand a salt crust. The
# light maps draw exactly as before. Look on the dark side says the dark tile's words; on the light side, the old ones.
# In a card match on the dark side the sky is mirrored (wUmbSkyMirrored), with the dead moon beside the moon.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbSkyMirrored === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; wSave()")

        # the chunk of the world around the Road to Nowhere (where the portal is), drawn with this part's drawers and with
        # the originals put back: the dark world's grass changes, the light world's pixels do not move at all
        js_px = """(LID => {
          const L = DB.locs.find(l => l.id === LID), cx = Math.floor(L.x / WCH), cy = Math.floor(L.y / WCH);
          const GND = Object.keys(wWU8BGnd), OBJ = Object.keys(wWU8BObj), mine = { g: {}, o: {} };
          for (const k of GND) mine.g[k] = WGND[k]; for (const k of OBJ) mine.o[k] = WOBJ[k];
          const orig = on => { for (const k of GND) WGND[k] = on ? wWU8BGnd[k] : mine.g[k]; for (const k of OBJ) WOBJ[k] = on ? wWU8BObj[k] : mine.o[k]; };
          const draw = id => { const m = MAPS[id], L2 = Object.assign({}, wLayer(m, 1), { chunks: {} }); return { m, K: wBuildChunk(L2, cx, cy) }; };
          // the mean colour of the grass tiles in a chunk, and a hash of every pixel
          const read = ({ m, K }) => { const d = K.cv.getContext('2d').getImageData(0, 0, K.cv.width, K.cv.height).data; let h = 0, s = [0, 0, 0], n = 0, g = 0;
            for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
            for (let y = cy * WCH; y < Math.min(m.h, cy * WCH + WCH); y++) for (let x = cx * WCH; x < Math.min(m.w, cx * WCH + WCH); x++) {
              if (!(m.t[y][x] in wWU8BGnd)) continue; g++;
              for (let yy = 8; yy < 24; yy += 2) for (let xx = 8; xx < 24; xx += 2) { const i = (((y - cy * WCH) * 32 + yy) * K.cv.width + (x - cx * WCH) * 32 + xx) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; } }
            return { h, grass: g, mean: s.map(v => Math.round(v / Math.max(1, n))) }; };
          try {
            const out = { dark: read(draw('u:world')), light: read(draw('world')) };
            orig(true); out.darkOrig = read(draw('u:world')); out.lightOrig = read(draw('world'));
            return out;
          } finally { orig(false); }
        })"""
        for lid, where in [('umbralden', 'round the Road to Nowhere (the portal\'s end of the world)'), ('graftonbury', 'round Graftonbury')]:
            px = await pg.evaluate(js_px, lid)
            check(px['dark']['grass'] > 10, f'the chunk {where} has ground this part redraws', px)
            check(px['dark']['mean'] != px['darkOrig']['mean'] and px['dark']['h'] != px['darkOrig']['h'], f'{where}, the dark world\'s ground is drawn its dark way: its pixels change', px)
            check(px['light']['h'] == px['lightOrig']['h'] and px['light']['mean'] == px['lightOrig']['mean'], f'{where}, the light world\'s pixels are what the original drawers give', px)

        ws = await pg.evaluate("Object.keys(MAPS).map(id => [id, !!MAPS[id].waterSh, !!MAPS[id].umbral]).filter(([id, w, u]) => w !== u)")
        check(ws == [], 'every dark map, and only a dark one, names its own water (black ichor, no white foam)', ws)

        # the dark water baked into a chunk is the ichor's (m.waterSh): with it, the Drownfen's water is far darker than
        # with the light shades put back, and not turquoise
        wt = await pg.evaluate("""(() => {
          const m = MAPS['u:world'], L = DB.locs.find(l => l.id === 'saltmere'), cx = Math.floor(L.x / WCH), cy = Math.floor(L.y / WCH);
          const mean = () => { const L2 = Object.assign({}, wLayer(m, 1), { chunks: {} }), K = wBuildChunk(L2, cx, cy), d = K.cv.getContext('2d').getImageData(0, 0, K.cv.width, K.cv.height).data;
            const s = [0, 0, 0, 0]; let n = 0;
            for (let y = cy * WCH; y < Math.min(m.h, cy * WCH + WCH); y++) for (let x = cx * WCH; x < Math.min(m.w, cx * WCH + WCH); x++) {
              if (m.t[y][x] !== '~') continue;
              for (let yy = 4; yy < 28; yy += 3) for (let xx = 4; xx < 28; xx += 3) { const i = (((y - cy * WCH) * 32 + yy) * K.cv.width + (x - cx * WCH) * 32 + xx) * 4; for (let j = 0; j < 4; j++) s[j] += d[i + j]; n++; } }
            return { n, mean: s.map(v => Math.round(v / Math.max(1, n))) }; };
          const ws = m.waterSh, out = { ichor: mean() };
          try { delete m.waterSh; out.light = mean(); } finally { m.waterSh = ws; }
          return out; })()""")
        ic, lt = wt['ichor']['mean'], wt['light']['mean']
        check(wt['ichor']['n'] > 100 and sum(ic[:3]) < sum(lt[:3]) - 30 and ic[1] < lt[1] - 12 and ic[1] <= ic[2], 'the dark world\'s water is baked as black ichor (its own shades, no turquoise), not the light water darkened', wt)

        # the seam at the dark world's edge: a frame drawn across its west and east edges, where the sea runs off the
        # map; just inside and just outside the edge, the water is the same colour
        eg = await pg.evaluate("""(() => { const m = MAPS['u:world'], out = {};
          for (const side of ['west', 'east']) {
            const cols = side === 'west' ? [0, 1, 2, 3] : [m.w - 4, m.w - 3, m.w - 2, m.w - 1];
            let y0 = -1; for (let y = 4; y < m.h - 10 && y0 < 0; y++) { let ok = true; for (let yy = y - 2; yy < y + 8 && ok; yy++) for (const x of cols) if (m.t[yy][x] !== '~') ok = false; if (ok) y0 = y; }
            if (y0 < 0) { out[side] = null; continue; }
            const cv = document.createElement('canvas'); cv.width = 640; cv.height = 320; const c = cv.getContext('2d');
            wDrawMap(c, 'u:world', side === 'west' ? -10 : m.w - 10, y0 - 2, 640, 320, 0, { noNight: true });
            const d = c.getImageData(0, 0, 640, 320).data, mean = (xa, xb) => { const s = [0, 0, 0]; let n = 0;
              for (let y = 2 * 32 + 4; y < 8 * 32 - 4; y++) for (let x = xa; x < xb; x++) { const i = (y * 640 + x) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
              return s.map(v => +(v / n).toFixed(1)); };
            const inner = side === 'west' ? mean(324, 372) : mean(268, 316), outer = side === 'west' ? mean(268, 316) : mean(324, 372);
            out[side] = { y0, inner, outer, diff: Math.max(...inner.map((v, j) => Math.abs(v - outer[j]))) };
          }
          return out; })()""")
        check(all(eg.get(k) for k in ('west', 'east')) and all(eg[k]['diff'] <= 5 for k in ('west', 'east')), 'the dark sea runs off the world\'s west and east edges without a seam' + (f" (largest channel difference {eg['west']['diff']} west, {eg['east']['diff']} east)" if eg.get('west') and eg.get('east') else ''), eg)

        # the dead moon never covers the lit moon, at any phase, and stays inside the skylight's frame (radius 26 of 30)
        dm = await pg.evaluate("""(() => { const keep = WG.map, out = [];
          const cv = document.createElement('canvas'); cv.width = cv.height = 80; const c = cv.getContext('2d');
          const px = fn => { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, 80, 80); fn(c, 40, 40, 20); return c.getImageData(0, 0, 80, 80).data; };
          try { WG.map = 'u:world';
            for (let ph = 0; ph < 8; ph++) {
              const a = px((c, x, y, r) => wWU8BDrawMoon(c, x, y, r, ph)), b = px((c, x, y, r) => drawMoon(c, x, y, r, ph));
              let lit = 0, hidden = 0, changed = 0, far = 0;
              for (let i = 0; i < a.length; i += 4) { const q = i / 4, dx = q % 80 + .5 - 40, dy = Math.floor(q / 80) + .5 - 40, ch = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12;
                if (a[i] > 170) { lit++; if (ch) hidden++; } if (ch) { changed++; if (Math.hypot(dx, dy) > 27.5) far++; } }
              out.push({ ph, lit, hidden, changed, far });
            }
          } finally { WG.map = keep; }
          return out; })()""")
        check(all(v['hidden'] <= 2 and v['changed'] >= 30 and v['far'] == 0 for v in dm), 'the dead moon is drawn at every phase, big enough to read as a ring (30 pixels or more), never over the lit moon, and inside the skylight\'s frame', dm)

        # each wrapped drawer, tile by tile: the dark map gets the dark look, the light map the original's to the pixel
        tl = await pg.evaluate("""(() => {
          const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'), out = {};
          const pix = (fn, m, P, seed) => { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 32, 32); c.save(); fn(c, P, wRng(seed || 1234), { m, L: null, x: 7, y: 9, at: () => '.' }); c.restore();
            const d = c.getImageData(0, 0, 32, 32).data; let h = 0; for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0; return h; };
          for (const [tab, orig] of [[WGND, wWU8BGnd], [WOBJ, wWU8BObj]]) for (const k in orig) {
            out[k] = { lightSame: pix(tab[k], MAPS.world, WINK.plains) === pix(orig[k], MAPS.world, WINK.plains),
              // (on some tile: the ichor's sheen is on a few of them)
              darkNew: [1, 2, 3, 4, 5, 6, 7, 8].some(sd => pix(tab[k], MAPS['u:world'], WINK.uplains, sd) !== pix(orig[k], MAPS['u:world'], WINK.uplains, sd)),
              stable: pix(tab[k], MAPS['u:world'], WINK.uplains) === pix(tab[k], MAPS['u:world'], WINK.uplains) };
          }
          return out; })()""")
        check(sorted(tl) == sorted(['.', '"', '~', 's', 'n', ':', 'T', 'f', 'p']), 'grass, tall grass, water, fen, snow, sand and the three kinds of tree all have a dark look', sorted(tl))
        check(all(v['lightSame'] for v in tl.values()), 'on a light map every one draws exactly as before', tl)
        check(all(v['darkNew'] and v['stable'] for v in tl.values()), 'on a dark map every one draws its dark look, the same each time for the same tile', tl)

        # Look: ash, ichor and a dead tree say the dark words; the same places in the light say the old ones
        lk = await pg.evaluate("""(() => { const out = {}, maps = Object.keys(MAPS).filter(id => id.startsWith('u:')), keep = [WG.map, WG.x, WG.y];
          for (const ch of Object.keys(W_UMB8B.look)) {
            // a bare tile of that kind (no words of its own, nobody on it), on the dark maps and on their light ones
            const find = ids => { for (const id of ids) { const m = MAPS[id];
              for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === ch && !m.meta[x + ',' + y] && !(m.npcs || []).some(n => n.x === x && n.y === y)) return [id, x, y]; } return null; };
            const at = find(maps), lt = find(maps.map(id => id.slice(2)));
            if (!at || !lt) { out[ch] = null; continue; }
            WG.map = at[0]; const dark = wLookText(at[1], at[2]);
            WG.map = lt[0]; const light = wLookText(lt[1], lt[2]);
            out[ch] = { at, lt, dark, light, wantDark: W_UMB8B.look[ch], wantLight: DB.tiles[ch].look };
          }
          // a place's own words stand on the dark side: the dark portal
          WG.map = 'u:umbralden'; const [px, py] = W_UMB.portal.umbralden; out.portal = wLookText(px, py);
          [WG.map, WG.x, WG.y] = keep; return out; })()""")
        kinds = [k for k in lk if k != 'portal']
        found = [k for k in kinds if lk[k]]
        check(len(kinds) == 9 and found == kinds, 'every one of the nine dark words has a bare tile to Look at on the dark maps', {k: bool(lk[k]) for k in kinds})
        for ch in found:
            v = lk[ch]
            check(v['dark'] == v['wantDark'] and v['light'] == v['wantLight'], f'Look on {ch!r} gives its dark words; the same kind of tile in the light, the old ones', v)
        check(lk['portal'].startswith('The portal, from the wrong side'), 'a place with words of its own keeps them on the dark side', lk['portal'])

        # the sky: mirrored on the dark side (the drawing flipped left for right), as it was in the light
        sk = await pg.evaluate("""(() => { const keep = WG.map, out = {};
          const run = id => { WG.map = id; const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH; const c = cv.getContext('2d'), calls = [];
            const sc = c.scale.bind(c); c.scale = (a, b) => { calls.push([a, b]); return sc(a, b); };
            drawSky(c); return { mirrored: wUmbSkyMirrored(), flips: calls.filter(([a, b]) => a === -1 && b === 1).length, svg: starsSVG(STARS[0]), moon: moonSVG(2) }; };
          out.dark = run('u:world'); out.ground = run('u:g_ballpark'); out.light = run('world'); out.town = run('graftonbury');
          WG.map = keep; return out; })()""")
        check(sk['dark']['mirrored'] and sk['dark']['flips'] == 1 and sk['ground']['mirrored'], 'on a dark map the sky is drawn mirrored left for right', sk)
        check(not sk['light']['mirrored'] and sk['light']['flips'] == 0 and not sk['town']['mirrored'], 'in the light it is drawn as it always was', sk)
        check(sk['dark']['svg'] != sk['light']['svg'] and 'scaleX(-1)' in sk['dark']['moon'] and 'scaleX(-1)' not in sk['light']['moon'], 'the moon\'s and the constellations\' small pictures are reversed with it', sk)

        # How to play says so; the audit is clean
        hp = await pg.evaluate("""(() => { showPage('help'); const u = document.getElementById('wHelpUmbral'), l = document.getElementById('wHelpUmbLand');
          const out = { inside: !!(u && l && u.contains(l)), text: l ? l.textContent : '' }; showPage('play'); out.audit = wAudit(); return out; })()""")
        check(hp['inside'] and 'ash' in hp['text'] and 'mirrored' in hp['text'], 'How to play\'s Umbral section explains the dark land and the mirrored sky', hp)
        check(hp['audit'] == [], 'the audit has no problems', hp['audit'])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
