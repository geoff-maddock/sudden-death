# Every place in the Realm drawn whole, for looking at (not a check): each city, ground, home, site and dungeon map
# rendered by the ink renderer at once, no night, into one PNG each, plus close-ups of each city's centre.
# Usage: python3 test/realm_places_shots.py [outdir] [id,id,...]   (default outdir /tmp/realm-places)
import asyncio, sys, os, base64
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/realm-places'
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 else None
SCALE = float(sys.argv[3]) if len(sys.argv) > 3 else None   # e.g. 2 for a close look
CROP = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else None   # x,y,w,h in tiles

DRAW = """(([id, sc, crop]) => {
  const m = MAPS[id]; if (!m) return null;
  const [x, y, w, h] = crop || [0, 0, m.w, m.h];
  const cv = document.createElement('canvas'); cv.width = Math.round(w * 32 * sc); cv.height = Math.round(h * 32 * sc);
  const c = cv.getContext('2d'); c.setTransform(sc, 0, 0, sc, 0, 0);
  wDrawMap(c, id, x, y, w * 32, h * 32, 0.4, { noNight: true });
  return cv.toDataURL('image/png');
})"""

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof MAPS !== 'undefined' && !!document.getElementById('bNew')")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        ids = await pg.evaluate("Object.keys(MAPS).filter(k => k !== 'world' && !/^home_|_house/.test(k))")
        for i in ids:
            if ONLY and i not in ONLY: continue
            kind = await pg.evaluate(f"MAPS['{i}'].kind")
            sc = SCALE or (0.75 if kind != 'dungeon' else 0.6)
            url = await pg.evaluate(DRAW, [i, sc, CROP])
            if not url: continue
            path = os.path.join(OUT, f'{kind}-{i}.png')
            with open(path, 'wb') as f: f.write(base64.b64decode(url.split(',')[1]))
            print(path)
        print('errors:', errs[:5])
        await br.close()

asyncio.run(main())
