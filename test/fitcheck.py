import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950}, device_scale_factor=2)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        await pg.evaluate("newRun('ironmaw',[0,1,2]); RUN.path=[]; beginFight({ids:['kqueen'], type:'boss', sport:'hockey'})"); await pg.wait_for_timeout(600)
        a = await pg.evaluate("[cv.clientWidth, cv.width, cv._d]")
        await pg.set_viewport_size({'width': 1000, 'height': 950}); await pg.wait_for_timeout(500)
        b2 = await pg.evaluate("[cv.clientWidth, cv.width, cv._d]")
        # simulate a layout shift without a resize event: make the page wider-scrolling
        await pg.evaluate("document.body.style.paddingRight = '40px'"); await pg.wait_for_timeout(500)
        c2 = await pg.evaluate("[cv.clientWidth, cv.width, cv._d]")
        # simulate a thrown draw mid-save
        await pg.evaluate("const _d = drawFight; let once = 1; drawFight = function (c, dt) { if (once) { once = 0; c.save(); c.shadowBlur = 30; c.shadowColor = '#f00'; throw new Error('test'); } return _d(c, dt); }; 0"); await pg.wait_for_timeout(500)
        d = await pg.evaluate("(() => { const c = cv.getContext('2d'); return [c.shadowBlur, c.filter]; })()")
        print(a, b2, c2, d, errs)
        await b.close()
asyncio.run(main())
