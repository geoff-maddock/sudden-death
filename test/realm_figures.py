"""The shared figures (issue #85) and utilities (issue #86): boxing, football, basketball and hockey draw their players with one file,
src/figures/figures.js, loaded inside each engine's scope. It names no engine, each engine gives it a clock
(figClock), no engine keeps a copy, and it draws every kind in every option without throwing."""
import asyncio, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:400])
    else:
        print('ok', what)
ENGINES = {'bx': 'BXT', 'gf': 'GFT', 'bk': 'BKT', 'hk': 'HKT'}
DRAW = """
(() => { const cv = document.createElement('canvas'); cv.width = 260; cv.height = 300; const c = cv.getContext('2d'), team = { color: '#3a6ab8', light: '#e2eeff', short: 'RIM' };
  const opts = [{ num: 7 }, { num: 12, run: 1.3, flip: true }, { num: 3, throwK: .6, lift: 4 }, { num: 9, glove: '#b8443a', pose: { armL: { x: -14, y: 6 }, armR: { x: 20, y: -8 }, legL: { x: -6, y: 0 }, legR: { x: 7, y: 0 }, lean: .2, shift: 2, drop: 1, scale: 1 } }, { num: 5, stone: true }];
  const threw = [], blank = []; let n = 0;
  for (const k of Object.keys(KIND)) for (const o of opts) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 260, 300); n++;
    try { drawFig(c, k, 130, 260, 150, team, Object.assign({}, o)); } catch (e) { threw.push(k + ': ' + e); continue; }
    const d = c.getImageData(0, 0, 260, 300).data; let ink = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++; if (ink < 500) blank.push(k); }
  const plain = (() => { c.clearRect(0, 0, 260, 300); drawFig(c, 'ogre', 130, 260, 150, team, { num: 9, pose: { armL: { x: -14, y: 6 }, armR: { x: 20, y: -8 }, legL: { x: -6, y: 0 }, legR: { x: 7, y: 0 }, lean: .2, shift: 2, drop: 1, scale: 1 } }); return cv.toDataURL(); })();
  const gloved = (() => { c.clearRect(0, 0, 260, 300); drawFig(c, 'ogre', 130, 260, 150, team, { num: 9, glove: '#b8443a', pose: { armL: { x: -14, y: 6 }, armR: { x: 20, y: -8 }, legL: { x: -6, y: 0 }, legR: { x: 7, y: 0 }, lean: .2, shift: 2, drop: 1, scale: 1 } }); return cv.toDataURL(); })();
  return { n, kinds: Object.keys(KIND).length, threw, blank, gloves: plain !== gloved }; })()
"""
async def main():
    fig = open(f'{ROOT}/src/figures/figures.js').read()
    util = open(f'{ROOT}/src/scoped/util.js').read()
    check(not re.search(r'\b(bx|gf|bk|hk)(Seed|Rand)\b|\b(BXT|GFT|BKT|HKT)\b', util.split('*/', 1)[1]) and 'function engSeed' in util, 'the shared utilities (issue #86) name no engine')
    check(not re.search(r'\b(BXT|GFT|BKT|HKT|BDT)\b', fig.split('*/', 1)[1]) and 'figClock()' in fig, 'the shared figures name no engine, and read the clock through figClock()')
    for e, T in ENGINES.items():
        man = open(f'{ROOT}/src/{e}/manifest.txt').read().split('\n')
        parts = ''.join(open(f'{ROOT}/{l}').read() for l in man if l.startswith(f'src/{e}/parts/'))
        check(man.count('src/figures/figures.js') == 1 and not os.path.exists(f'{ROOT}/src/{e}/parts/03-figures.js') and not re.search(r'^function drawFig\b', parts, re.M),
              f'{e}: loads the shared figures once and keeps no copy of its own')
        check(man.count('src/scoped/util.js') == 1 and not os.path.exists(f'{ROOT}/src/{e}/parts/01-util.js') and not re.search(r'^function \w*Seed\b', parts, re.M), f'{e}: loads the shared utilities once and keeps no copy of its own')
        check(len(re.findall(r'^function figClock\(\) \{ return ' + T + r'\.t; \}', parts, re.M)) == 1, f'{e}: defines figClock on its own drawing clock ({T}.t)')
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for e in ENGINES:
            await pg.goto('about:blank')
            await pg.add_script_tag(content=util + '\nfunction figClock() { return 1.234; }\n' + fig)
            r = await pg.evaluate(DRAW)
            check(r['kinds'] >= 18 and not r['threw'] and not r['blank'] and r['gloves'], f"{e}: every kind draws in every option ({r['n']} pictures), and gloves show", r)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
