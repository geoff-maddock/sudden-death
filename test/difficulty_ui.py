import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':1000})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        # default from Settings
        await pg.evaluate("showSettings()"); await pg.select_option('#sDiff', '2'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/diff_settings.png'); await pg.click('[data-close]')
        await pg.click('#bNew'); await pg.click('[data-mode=club]'); await pg.click('[data-club=mirewood]')
        for i in [0,1,2]: await pg.click(f'[data-pi="{i}"]')
        sel = await pg.evaluate("document.querySelector('[data-diff][aria-checked=true]').textContent")
        await pg.screenshot(path='/tmp/diff_draft.png', clip={'x':0,'y':860,'width':1300,'height':140})
        await pg.click('[data-diff="3"]'); await pg.click('#bGo'); await pg.wait_for_timeout(300)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.locator('.mnode.can').first.dispatch_event('click'); await pg.wait_for_timeout(1200)
        st = await pg.evaluate("[RUN.diff, diffOf(RUN).n, B.hand.length, SET.diff]")
        await pg.evaluate("recordRun('quit'); showPage('rec')"); await pg.wait_for_timeout(300)
        tag = await pg.evaluate("document.querySelector('#pg-rec .hlt') && document.querySelector('#pg-rec .hlt').textContent")
        old = await pg.evaluate("diffOf({ hard: 1 }).n + ' / ' + diffOf({}).n")
        print('settings default picked on draft:', sel, '| run:', st, '| record tag:', tag, '| old saves:', old, '| errors:', errs)
        await b.close()
asyncio.run(main())
