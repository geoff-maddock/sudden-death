import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; showView('map'); renderMap();"); await pg.wait_for_timeout(400)
        sched = await pg.evaluate("[Object.values(RUN.map.nodes).filter(n => ['fight','elite','rival'].includes(n.t)).every(n => n.sport), scheduleCounts().map(x => x.join(':')).join(' ')]")
        await pg.screenshot(path='/tmp/sched_map.png')
        # entering a room plays its published sport
        played = await pg.evaluate("(() => { const n = Object.values(RUN.map.nodes).find(n => n.r === 0); const e = rollEncounter('normal', n.sport); return [n.sport, e.sport]; })()")
        # practiced cards score better: same 10-damage hit in hockey, plain vs practiced
        r = await pg.evaluate("""(() => { const out = {};
          for (const sk of [0, 1]) { newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.deck.forEach(c => c.sk = sk); startCombat(['lb'], 'normal', 'hockey'); B.energy = 9; B.enemies[0].block = 0; const c = mkCard('check'); c.sk = sk; B.hand.unshift(c); B.P.st.str = 4; playCard(0, B.enemies[0].uid); out['hockey sk' + sk] = B.sc.us; }
          for (const sk of [0, 1]) { newRun('ironmaw',[0,1,2]); RUN.path=[]; startCombat(['lb'], 'normal', 'baseball'); B.energy = 9; B.enemies[0].block = 0; const c = mkCard('check'); c.sk = sk; B.hand.unshift(c); playCard(0, B.enemies[0].uid); out['baseball sk' + sk] = B.sc.bases.join(''); }
          return out; })()""")
        # practice at the locker room
        await pg.evaluate("newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.panel = { t: 'rest' }; renderPanel();"); await pg.wait_for_timeout(300)
        await pg.click('#rPractice'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/practice_pick.png')
        await pg.locator('#modalBox .card').first.click(); await pg.wait_for_timeout(300)
        n = await pg.evaluate("RUN.deck.filter(c => c.sk).length")
        print('every fight room has a sport:', sched[0], '|', sched[1]); print('room sport played:', played)
        print('practice effect:', r); print('practiced at locker room:', n); print('errors:', errs)
        await b.close()
asyncio.run(main())
