import asyncio, json, sys
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1300,'height':900})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto(GAME_URL)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/s_title.png')
        await pg.click('#bNew'); await pg.wait_for_timeout(300)
        await pg.click('[data-club=mirewood]'); await pg.wait_for_timeout(300)
        for i in [0,3,4]: await pg.click(f'[data-pi="{i}"]')
        await pg.screenshot(path='/tmp/s_draft.png', full_page=True)
        await pg.click('#bGo'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/s_map.png', full_page=True)
        await pg.locator('.mnode.can').first.dispatch_event('click'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/tmp/s_fight.png', full_page=True)
        print(json.dumps(errs[:10]))
        print(await pg.evaluate('window.__sdErrs'))
        await b.close()
asyncio.run(main())
