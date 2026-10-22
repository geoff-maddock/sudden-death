import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('cragspire',[0,1,2]); RUN.path=[]; showView('map'); renderMap();"); await pg.wait_for_timeout(400)
        g = pg.locator('.mnode[data-tip] circle.ring').first
        await g.scroll_into_view_if_needed(); await g.hover(force=True); await pg.wait_for_timeout(500)
        r = await pg.evaluate("(() => { const t = document.querySelector('.tip, #tip'); return !!t && !t.hidden && getComputedStyle(t).display !== 'none' && t.textContent.length > 10; })()"); print('tooltip on hover:', 'ok' if r else 'BROKEN')
        await pg.screenshot(path='/tmp/tt.png')
        await b.close()
asyncio.run(main())
