import asyncio, sys, json
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
clubs = sys.argv[1].split(','); N = int(sys.argv[2])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__SD_LAB = true;')
        await pg.goto(GAME_URL); await pg.add_script_tag(path=ROOT + '/test/lab.js')
        for c in clubs:
            r = await pg.evaluate(f"(() => {{ let w = 0, acts = [0,0,0,0], e = []; for (let i = 0; i < {N}; i++) {{ try {{ const l = LABRUN({{route:'balanced', club:'{c}'}}); if (l.result === 'win') w++; acts[Math.min(3, RUN.act + (l.result === 'win' ? 1 : 0))]++; }} catch (x) {{ e.push(x.message); }} }} return [w / {N}, acts, e.slice(0, 2)]; }})()")
            print(c, r, flush=True)
        print(errs)
        await b.close()
asyncio.run(main())
