import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.clock = 12; beginFight({ids:['skelss','lb'], type:'normal', sport:'baseball'}); A.banner=null;")
        await pg.wait_for_timeout(600)
        await pg.evaluate("B.P.st.str = 2; B.enemies[0].st.vuln = 1; B.sc.bases=[1,1,0]; B.sc.us = 3; momentumCheck(); B.hand.unshift(mkCard('dwf_axe')); renderFightHUD(); UI.hoverCard = 0; updatePreview();")
        await pg.wait_for_timeout(500)
        print(await pg.evaluate("JSON.stringify(UI.why)"))
        await pg.screenshot(path='/tmp/why.png', clip={'x':0,'y':500,'width':1300,'height':300})
        print(errs)
        await b.close()
asyncio.run(main())
