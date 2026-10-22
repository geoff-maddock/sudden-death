import asyncio, json
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':1100})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(500)
        await pg.add_script_tag(path=ROOT + '/test/lab.js')
        r = await pg.evaluate("""(() => { const out = [];
          for (let i = 0; i < 2; i++) { const l = LABRUN({route:'balanced'}); LAB = false; const T = seasonTotals(RUN.games);
            const owners = [...new Set(RUN.deck.map(c => c.own || '-'))];
            out.push({ res: l.result, games: RUN.games.length, totals: T, party: RUN.party.map(p => p.kind), owners, dmgStat: RUN.stats.dmg, sumD: Object.values(T).reduce((s,o)=>s+o.d,0) });
            recordRun(l.result === 'win' ? 'win' : 'lose'); }
          return out; })()""")
        for x in r: print(json.dumps(x)[:600])
        await pg.evaluate("showEnd(RUN.over)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path='/tmp/st_end.png', full_page=True)
        await pg.evaluate("showStats(RUN.games, RUN.party, CLUBS[RUN.club].short, 'Player stats this run')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/st_modal.png')
        await pg.click('#modalBox [data-metric=p]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/st_modal_p.png')
        await pg.evaluate("document.getElementById('modal').hidden = true; showPage('rec')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/st_rec.png', full_page=True)
        await pg.click('[data-career]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/st_career.png')
        print(errs, await pg.evaluate('window.__sdErrs'))
        await b.close()
asyncio.run(main())
