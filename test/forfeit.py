import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1300,'height':950})
        for where in ['map', 'fight']:
            pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console ' + m.text[:300]) if m.type == 'error' and 'resource' not in m.text else None)
            pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))  # a blocked dialog behaves like a dismissed one
            await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
            await pg.evaluate("localStorage.clear()")
            await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
            await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; saveRun();" + (" const enc = rollEncounter('normal'); RUN.pending = enc; beginFight(enc);" if where == 'fight' else " showView('map'); renderMap();"))
            await pg.wait_for_timeout(1500)
            if where == 'fight': await pg.evaluate("snapBattle()")
            await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(500)
            await pg.click('#bResume'); await pg.wait_for_timeout(800)
            await pg.click('#bAbandon'); await pg.wait_for_timeout(300); await pg.click('#cfYes'); await pg.wait_for_timeout(600)
            print(where, await pg.evaluate("[UI.screen, UI.view, !!RUN && RUN.over]"), errs[:4])
        await b.close()
asyncio.run(main())
