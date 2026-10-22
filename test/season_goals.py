import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':1000})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.goals = { 0: [{ id: 'clean', done: false }, { id: 'home', done: false }] };")
        # win a baseball game 4-0 with a homer by a practiced card: completes 'clean', counts toward 'home'
        await pg.evaluate("""(() => { beginFight({ ids: ['lb'], type: 'normal', sport: 'baseball' }); A.banner = null; B.energy = 9; B.sc.bases = [1,1,1];
          const c = mkCard('dwf_axe'); c.sk = 1; B.hand.unshift(c); B.P.st.str = 8; playCard(0, B.enemies[0].uid);
          B.enemies.forEach(e => { e.hp = 0; e.dead = true; }); B.over = 'win'; sportFinal(); finishFight(); })()""")
        await pg.wait_for_timeout(1200)
        r = await pg.evaluate("[RUN.panel && RUN.panel.goals, RUN.panel && RUN.panel.potg, RUN.fans, RUN.goals[0].map(g => g.id + ':' + g.done)]")
        await pg.screenshot(path='/tmp/goal_reward.png', clip={'x':0,'y':180,'width':1300,'height':420})
        await pg.evaluate("RUN.panel = null; showView('map'); renderMap();"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/goal_map.png')
        await pg.evaluate("RUN.fans = 300; RUN.panel = { t: 'shop', shop: makeShop() }; renderPanel();"); await pg.wait_for_timeout(300)
        await pg.click('[data-fan=hp]'); await pg.wait_for_timeout(200)
        s = await pg.evaluate("[RUN.fans, RUN.maxhp]")
        print('goals hit:', r[0], '| play of the game:', r[1], '| fans:', r[2], '| goals:', r[3], '| after fan stand:', s, '| errors:', errs)
        await b.close()
asyncio.run(main())
