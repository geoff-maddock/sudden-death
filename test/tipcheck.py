import asyncio
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(500)
        r = await pg.evaluate('''(() => { const bad = []; newRun('mirewood',[0,1,4]); RUN.path=[];
          for (const id of Object.keys(ENEMIES)) { RUN.act = 0; startCombat([id], ENEMIES[id].boss ? 'boss' : 'normal', 'hockey'); B.lt = { atk: 3, skl: 2, pow: 1, blk: 20, top: 25, dmg: 40 };
            const e = B.enemies.find(x => x.id === id) || B.enemies[0];
            for (const k of Object.keys(ENEMIES[id].moves)) { e.intent = k; for (const plan of [null, 1]) { e.plan = plan ? planOps(e) : undefined; try { intentInfo(e); intentDesc(e); enemyTip(e); } catch (x) { bad.push(id + '.' + k + ': ' + x.message); } } } }
          return bad; })()''')
        print('tooltip/intent failures:', r); print('page errors:', errs)
        await b.close()
asyncio.run(main())
