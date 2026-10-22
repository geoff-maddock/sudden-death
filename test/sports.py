import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
SPORTS = ['baseball','football','hockey','basketball','curling','boxing','golf','jousting','bowling']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 950})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(500)
        for s in SPORTS:
            await pg.evaluate(f"newRun('ironmaw',[0,3,4]); RUN.path=[]; beginFight({{ids:['skelss','lb'], type:'normal', sport:'{s}'}}); A.banner=null;")
            await pg.wait_for_timeout(300)
            await pg.evaluate("""(() => { A.banner = null; B.energy = 9; B.hand = [mkCard('dwf_axe'), mkCard('check'), mkCard('ogr_log'), mkCard('hold'), mkCard('glm_ramp')];
              for (let k = 0; k < 4 && B.hand.length; k++) { const i = 0; playCard(i, 1); }
              if (B.sport === 'baseball') { B.sc.bases = [1, 0, 1]; }
              if (B.sport === 'football') { B.yards = 80; }
              renderFightHUD(); })()""")
            await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'/tmp/s_{s}.png', clip={'x': 0, 'y': 150, 'width': 1300, 'height': 620})
        print(errs, await pg.evaluate('window.__sdErrs'))
        await b.close()
asyncio.run(main())
