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
        await pg.evaluate("newRun('frostfang',[0,1,2]); RUN.path=[]; showView('map'); renderMap();"); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/tmp/tip_map.png')
        await pg.click('#cOk'); await pg.wait_for_timeout(300)
        await pg.evaluate("beginFight({ids:['skelss'], type:'boss', sport:'hockey'})"); await pg.wait_for_timeout(1500)
        print(await pg.evaluate("[document.getElementById('coach').hidden, document.querySelector('#coach b').textContent, tipQ.slice()]"))
        await pg.click('#cOk'); await pg.wait_for_timeout(800)
        print(await pg.evaluate("[document.getElementById('coach').hidden, document.querySelector('#coach b').textContent, tipQ.slice()]"))
        await pg.click('#cOff'); await pg.wait_for_timeout(300)
        print(await pg.evaluate("[document.getElementById('coach').hidden, SET.tips]"))
        print(errs)
        await b.close()
asyncio.run(main())
