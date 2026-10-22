import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
CASES = [('baseball', "sportPop({k:'bat', n:4})", .55), ('hockey', "sportPop({k:'score', what:'goal', n:1}); A.lamp = A.t", .75), ('football', "sportPop({k:'score', what:'touchdown', n:7})", .7),
         ('football', "sportPop({k:'score', what:'field goal', n:3})", .6), ('golf', "sportPop({k:'drive'})", .5), ('bowling', "sportPop({k:'strike'})", .3),
         ('jousting', "sportPop({k:'score', what:'lance', n:1})", .3), ('curling', "B.sc.stones = 1; sportPop({k:'score', what:'stone', n:1})", .6), ('boxing', "sportPop({k:'bell'})", .2)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        for i, (sport, js, at) in enumerate(CASES):
            await pg.evaluate(f"TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; beginFight({{ids:['lb'], type:'normal', sport:'{sport}'}}); A.banner=null;")
            await pg.wait_for_timeout(700)
            # freeze time at a chosen moment of the animation so the frame is deterministic
            await pg.evaluate(f"UI.paused = false; A.banner = null; {js}; A.spops.forEach(p => p.t0 = A.t - p.life * {at}); UI.paused = true;")
            await pg.wait_for_timeout(250)
            await pg.screenshot(path=f'/tmp/pop{i}.png', clip={'x':55,'y':200,'width':1190,'height':560})
            await pg.evaluate("UI.paused = false")
        print('errors:', errs)
        await b.close()
asyncio.run(main())
