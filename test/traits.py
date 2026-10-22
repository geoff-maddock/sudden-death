import asyncio, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        await pg.evaluate("localStorage.setItem('sd-tips', JSON.stringify(Object.keys(TIPS))); TIPS_SEEN.push(...Object.keys(TIPS)); newRun('cragspire',[0,1,2]); RUN.path=[]; showView('map'); renderMap();")
        await pg.wait_for_timeout(500)
        n = await pg.evaluate("Object.values(RUN.map.nodes).filter(n => n.t === 'elite').map(n => n.trait)")
        print('elites on map:', n)
        el = pg.locator('.mnode[data-tip]').first
        await el.scroll_into_view_if_needed(); await el.hover(); await pg.wait_for_timeout(400)
        await pg.screenshot(path='/tmp/traits_map.png')
        # each trait applies and pays
        r = await pg.evaluate("""(() => { const out = {}; for (const t of Object.keys(ELITE_TRAITS)) { newRun('ironmaw',[0,1,2]); RUN.path=[]; const enc = rollEncounter('elite'); enc.trait = t; beginFight(enc);
            const e = B.enemies[0]; out[t] = { str: sv(e,'str'), blk: e.block, hp: e.hp + '/' + e.max, weak: sv(e,'weak'), slimed: B.draw.concat(B.hand).filter(c => c.id === 'slimed').length };
            B.enemies.forEach(x => { x.hp = 0; x.dead = true; }); const rw = combatRewards(); out[t].reward = { gold: rw.gold, cards: rw.cards.length, tonic: rw.tonic, trait: rw.trait }; } return out; })()""")
        for k, v in r.items(): print(k, v)
        print(errs)
        await b.close()
asyncio.run(main())
