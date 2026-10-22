import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':1000})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(500)
        await pg.click('#bNew'); await pg.click('[data-mode=free]'); await pg.wait_for_timeout(300)
        await pg.click('[data-relic=lantern]')
        for i in [3, 10, 17]: await pg.click(f'[data-pi="{i}"]')
        await pg.screenshot(path='/tmp/free_draft.png', full_page=True)
        await pg.click('#bGo'); await pg.wait_for_timeout(500)
        print(await pg.evaluate("[RUN.club, RUN.party.map(p=>p.n+':'+p.kind), RUN.relics, RUN.deck.map(c=>c.id).slice(-3)]"))
        await pg.locator('.mnode.can').first.dispatch_event('click'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/tmp/free_fight.png')
        # a full bot run as free agents, then records
        await pg.add_script_tag(path=ROOT + '/test/lab.js')
        r = await pg.evaluate("""(() => { const out = []; for (let i = 0; i < 6; i++) { DR.cls = genDraftClass(); const l = (() => { LAB = true; newRun('free', shuffle([...Array(18).keys()]).slice(0,3), DR.cls, 'horn'); return 1; })(); } return 'ok'; })()""")
        print(r, errs, await pg.evaluate('window.__sdErrs'))
        await b.close()
asyncio.run(main())
