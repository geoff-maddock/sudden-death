import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1200,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.panel = { t: 'chest', relic: 'foam', gold: 38 }; renderPanel();")
        await pg.wait_for_timeout(400); await pg.screenshot(path='/tmp/ch0.png')
        await pg.click('#bOpen')
        for i,ms in enumerate([300, 400, 400, 900]): await pg.wait_for_timeout(ms); await pg.screenshot(path=f'/tmp/ch{i+1}.png')
        print(await pg.evaluate("[RUN.gold, RUN.relics]"))
        await pg.evaluate("renderPanel()"); await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/ch5.png')
        print(errs)
        await b.close()
asyncio.run(main())
