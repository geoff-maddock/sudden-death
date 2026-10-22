"""Realm ink renderer (src/realm/w4-ink.js): contact sheets, world/town/dungeon/night views, actors, and a frame-time check.
Builds dist/realm.html, injects test/fixtures/realm_tiles.js only if the real DB/MAPS are not there yet, and asserts:
no page errors or __sdErrs, every DB.tiles code draws visible pixels, and a cached world repaint averages < 8 ms.
Screenshots go to /tmp/realm-*.png."""
import asyncio, os, subprocess, sys, base64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

HELPERS = r"""
window.__wt = {
  canvas(w, h) {
    let cv = document.getElementById('wt-cv');
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'wt-cv'; document.body.appendChild(cv); }
    const d = window.devicePixelRatio || 1; cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return c;
  },
  png() { return document.getElementById('wt-cv').toDataURL('image/png'); },
  // a synthetic map: every code in its own 3x3 cell on the code's natural surroundings
  gallery(region, kind) {
    const codes = Object.keys(DB.tiles), cols = 10, rows = Math.ceil(codes.length / cols), w = cols * 3, h = rows * 3;
    const t = []; for (let y = 0; y < h; y++) t.push(Array(w).fill(kind === 'dungeon' ? 'g' : '.'));
    const pos = {};
    codes.forEach((ch, i) => {
      const cx = (i % cols) * 3 + 1, cy = Math.floor(i / cols) * 3 + 1;
      const around = ch === 'b' || ch === 'j' || ch === 'w' ? '~' : '#X'.includes(ch) || ch === '+' ? '_' : ch === 'L' ? 'a' : ch === '~' ? ':' : null;
      if (around) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t[cy + dy][cx + dx] = around;
      if (ch === 'b' || ch === 'w') { t[cy][cx - 1] = '.'; t[cy][cx + 1] = '.'; }
      if (ch === '+' ) { t[cy][cx - 1] = '#'; t[cy][cx + 1] = '#'; }
      if (ch === '#' || ch === 'X') { t[cy - 1][cx] = ch; t[cy][cx - 1] = ch; }
      t[cy][cx] = ch; pos[ch] = [cx, cy];
    });
    const id = '__gal_' + region + '_' + kind;
    MAPS[id] = { id, name: id, kind, w, h, t: t.map(r => r.join('')), npcs: [], spawn: [1, 1], meta: {}, light: [], region };
    wInvalidate(id);
    return { id, w, h, pos, codes };
  },
  drawGallery(region, kind) {
    const g = this.gallery(region, kind), W = g.w * WTILE, H = g.h * WTILE + 30, c = this.canvas(W, H);
    c.fillStyle = '#140f0c'; c.fillRect(0, 0, W, H);
    c.save(); c.translate(0, 30); wDrawMap(c, g.id, 0, 0, g.w * WTILE, g.h * WTILE, 1.3, {}); c.restore();
    txt(c, `${region}${kind === 'dungeon' ? ' (dungeon)' : ''}: every tile code`, 8, 21, F_TXT(16), '#efe4cc');
    g.codes.forEach(ch => { const [x, y] = g.pos[ch]; const s = `${ch} ${DB.tiles[ch].name}`; c.font = F_HUD(13); const tw = c.measureText(s).width + 6;
      c.fillStyle = 'rgba(20,15,12,.78)'; c.fillRect(x * 32 + 16 - tw / 2, 30 + y * 32 + 33, tw, 13); txt(c, s, x * 32 + 16, 30 + y * 32 + 44, F_HUD(13), '#efe4cc', 'center'); });
    return g;
  },
  view(mapId, cx, cy, w, h, t, opts) {
    const c = this.canvas(w, h); c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const camX = cx - w / WTILE / 2, camY = cy - h / WTILE / 2;
    wDrawMap(c, mapId, camX, camY, w, h, t || 0, opts || {});
    return { c, camX, camY };
  },
  // every code alone (1x1 map) must put visible, non-uniform pixels down, and objects must differ from bare ground
  blankCheck() {
    const bad = [], d = window.devicePixelRatio || 1;
    const sample = (ch, kind) => {
      const id = '__one'; MAPS[id] = { id, name: id, kind, w: 1, h: 1, t: [ch], npcs: [], spawn: [0, 0], meta: {}, light: [], region: 'plains' }; wInvalidate(id);
      const c = this.canvas(32, 32); c.clearRect(0, 0, 32, 32); wDrawMap(c, id, 0, 0, 32, 32, .5, {});
      return c.getImageData(0, 0, Math.round(32 * d), Math.round(32 * d)).data;
    };
    for (const kind of ['town', 'dungeon']) {
      const plain = sample(kind === 'dungeon' ? 'g' : '.', kind);
      for (const ch of Object.keys(DB.tiles)) {
        const px = sample(ch, kind);
        let opaque = 0, diff = 0; const cols = new Set();
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3] > 200) opaque++; cols.add((px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4)); if (Math.abs(px[i] - plain[i]) + Math.abs(px[i + 1] - plain[i + 1]) + Math.abs(px[i + 2] - plain[i + 2]) > 40) diff++; }
        const n = px.length / 4, isGround = DB.tiles[ch].ground && !'#X^bw'.includes(ch);
        if (opaque < n * .9) bad.push(`${kind} ${ch}: only ${(100 * opaque / n).toFixed(0)}% opaque`);
        else if (cols.size < 3) bad.push(`${kind} ${ch}: flat (${cols.size} colours)`);
        else if (!isGround && ch !== (kind === 'dungeon' ? 'g' : '.') && diff < n * .03) bad.push(`${kind} ${ch}: looks like bare ground`);
      }
    }
    delete MAPS.__one; wInvalidate('__one');
    return bad;
  },
};
"""

async def shot(pg, path):
    data = await pg.evaluate('__wt.png()')
    open(path, 'wb').write(base64.b64decode(data.split(',', 1)[1]))
    print('wrote', path)

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1400, 'height': 1000}, device_scale_factor=2)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL)
        await pg.wait_for_timeout(500)
        # the real maps exist only once w2 has built them
        await pg.evaluate("typeof buildAllMaps === 'function' && !(MAPS.world) && buildAllMaps()")
        real =await pg.evaluate("typeof DB !== 'undefined' && typeof MAPS !== 'undefined' && !!(MAPS.world)")
        if not real:
            await pg.add_script_tag(path=os.path.join(ROOT, 'test/fixtures/realm_tiles.js'))
        print('data:', 'real DB/MAPS' if real else 'fixture')
        await pg.add_script_tag(content=HELPERS)
        assert await pg.evaluate("typeof wDrawMap === 'function' && typeof wInvalidate === 'function' && typeof wDrawActor === 'function' && WTILE === 32"), 'renderer API missing'
        assert await pg.evaluate("['plains','bloom','tide','ember','rime'].every(r => WINK[r] && WINK[r].paper && WINK[r].ink && WINK[r].accent && WINK[r].under)"), 'WINK palettes incomplete'

        # 1. contact sheets: every code in every region palette, plus a dungeon variant
        for reg in ['plains', 'bloom', 'tide', 'ember', 'rime']:
            await pg.evaluate(f"__wt.drawGallery('{reg}', 'town')")
            await shot(pg, f'/tmp/realm-gallery-{reg}.png')
        await pg.evaluate("__wt.drawGallery('ember', 'dungeon')")
        await shot(pg, '/tmp/realm-gallery-dungeon.png')

        # 2. world views across the regions, a town, a dungeon
        views = [('world-plains', 'world', 48, 36), ('world-rime', 'world', 22, 14), ('world-ember', 'world', 70, 17),
                 ('world-tide', 'world', 72, 56), ('world-bloom', 'world', 22, 50), ('world-isle', 'world', 18, 67),
                 ('town', 'graftonbury', 18, 12), ('town-saltmere', 'saltmere', 16, 12), ('town-rimewatch', 'rimewatch', 14, 11),
                 ('dungeon', 'genevault', 22, 16), ('dungeon-ember', 'emberdeep', 22, 16)]
        for name, mid, cx, cy in views:
            await pg.evaluate(f"__wt.view('{mid}', {cx}, {cy}, 1200, 800, 2.0)")
            await shot(pg, f'/tmp/realm-{name}.png')
        # the whole world at a small scale (exercises chunks at another device scale)
        await pg.evaluate("""(() => { const m = MAPS.world, c = __wt.canvas(m.w * 8, m.h * 8); c.setTransform(.5, 0, 0, .5, 0, 0); wDrawMap(c, 'world', 0, 0, m.w * 32, m.h * 32, 0, {}); })()""")
        await shot(pg, '/tmp/realm-world-overview.png')

        # 3. night: world near Graftonbury with a lantern, and a town lit by its lamps
        await pg.evaluate("__wt.view('world', 48, 38, 1200, 800, 3.1, { night: .85, lights: [[48, 39, 4]] })")
        await shot(pg, '/tmp/realm-night.png')
        await pg.evaluate("__wt.view('graftonbury', 18, 12, 1200, 800, 3.1, { night: .8, lights: [[18, 13, 3.5]] })")
        await shot(pg, '/tmp/realm-night-town.png')

        # 4. actors: several kinds, facing both ways, standing and mid-stride, on the town square
        await pg.evaluate("""(() => {
          const { c, camX, camY } = __wt.view('graftonbury', 18, 12, 1200, 800, 1, {});
          const kinds = ['goblin', 'werewolf', 'dwarf', 'ogre', 'troll', 'harpy', 'elf', 'wraith', 'lich', 'skeleton', 'witch', 'slime', 'gorgon', 'minotaur'];
          kinds.forEach((k, i) => {
            const x = (6 + (i % 7) * 4 - camX) * WTILE + 16, y = (8 + Math.floor(i / 7) * 5 - camY) * WTILE + 28;
            wDrawActor(c, { kind: k, face: 'r' }, x, y, 1);
            wDrawActor(c, { kind: k, face: 'l', walk: 1.6, col: '#3fbf9f' }, x + 32, y + 32 * 2, 1);
          });
        })()""")
        await shot(pg, '/tmp/realm-actors.png')

        # 5. the layer cache must not depend on the order chunks were built in (an out-of-map ground lookup once aliased the next row)
        same = await pg.evaluate("""(() => {
          wInvalidate('world'); __wt.view('world', 18, 67, 1200, 800, 2); const a = __wt.png();
          wInvalidate('world'); for (const [x, y] of [[90, 10], [70, 40], [48, 36], [5, 60]]) __wt.view('world', x, y, 1200, 800, 2);
          __wt.view('world', 18, 67, 1200, 800, 2); return a === __wt.png(); })()""")
        print('chunk cache order-independent:', same)

        # 5. every tile code draws something
        bad = await pg.evaluate('__wt.blankCheck()')
        print('blank tiles:', bad or 'none')

        # 6. frame time: a cached world repaint, camera drifting inside already-built chunks
        perf = await pg.evaluate("""(() => {
          const c = __wt.canvas(1200, 800);
          const cx = 48 - 1200 / 64, cy = 36 - 800 / 64;
          for (let i = 0; i < 3; i++) wDrawMap(c, 'world', cx + i * .1, cy, 1200, 800, i / 60, { night: 0 });
          wDrawMap(c, 'world', cx + 2, cy + 1.5, 1200, 800, 0, {});
          c.getImageData(0, 0, 1, 1);
          const N = 90, T = []; const t0 = performance.now();
          for (let i = 0; i < N; i++) { const a = performance.now(); wDrawMap(c, 'world', cx + (i % 30) / 15, cy + Math.floor(i / 30) / 2, 1200, 800, i / 60, {}); T.push(performance.now() - a); }
          c.getImageData(0, 0, 1, 1);
          const total = (performance.now() - t0) / N; T.sort((a, b) => a - b);
          const n = []; const t1 = performance.now();
          for (let i = 0; i < 30; i++) wDrawMap(c, 'world', cx + i / 15, cy, 1200, 800, i / 60, { night: .8, lights: [[48, 38, 4], [50, 36, 3]] });
          c.getImageData(0, 0, 1, 1);
          return { avg: total, median: T[N >> 1], p95: T[Math.floor(N * .95)], night: (performance.now() - t1) / 30, dpr: devicePixelRatio };
        })()""")
        print('frame ms (1200x800 at dpr %s): avg %.2f, median %.2f, p95 %.2f; night avg %.2f' % (perf['dpr'], perf['avg'], perf['median'], perf['p95'], perf['night']))
        sd_errs = await pg.evaluate('window.__sdErrs || []')
        print('errors:', errs, sd_errs)
        await b.close()
    assert not errs, f'page errors: {errs}'
    assert not sd_errs, f'__sdErrs: {sd_errs}'
    assert not bad, f'tiles that drew nothing useful: {bad}'
    assert same, 'world rendering depends on the order chunks were cached in'
    assert perf['avg'] < 8, f"cached world repaint too slow: {perf['avg']:.2f} ms"
    print('OK')

asyncio.run(main())
