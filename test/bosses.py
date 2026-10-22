import asyncio, json, sys
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 950})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(600)
        for act, boss in [(0,'argus'),(0,'groundskeeper'),(0,'kqueen'),(1,'cube'),(1,'zamboni'),(1,'banshee'),(2,'baron'),(2,'wyrm'),(2,'mirror')]:
            await pg.evaluate(f"newRun('mirewood',[0,1,4]); RUN.path=[]; RUN.act={act}; RUN.bossIds=[null,null,null]; RUN.bossIds[{act}]='{boss}'; beginFight(rollEncounter('boss'));")
            for _ in range(40):
                if await pg.evaluate('A.t > (B.enemies.map(e=>entA(e.uid).enter||0).reduce((a,b)=>Math.max(a,b),0)) + 1.6'): break
                await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'/tmp/b_{boss}.png', clip={'x':0,'y':150,'width':1300,'height':620})
            # run its first two moves for visible effects
            await pg.evaluate("doEndTurn()"); await pg.wait_for_timeout(1700)
            await pg.screenshot(path=f'/tmp/b_{boss}_move.png', clip={'x':0,'y':150,'width':1300,'height':620})
            await pg.wait_for_timeout(1500)
        print(errs, await pg.evaluate('window.__sdErrs'))
        await b.close()
asyncio.run(main())
