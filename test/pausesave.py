import asyncio, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
STATE = """JSON.stringify({ turn: B.turn, energy: B.energy, hand: B.hand.map(c => c.id + (c.up ? '+' : '')), draw: B.draw.length, disc: B.discard.length,
  foes: B.enemies.map(e => [e.id, e.hp, e.block, e.intent, JSON.stringify(e.st)]), sc: [B.sc.us, B.sc.them], hp: RUN.hp, sport: B.sport, clock: RUN.clock })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1300,'height':950})
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('gallowmere',[0,1,2]); RUN.path=[]; const enc = rollEncounter('elite'); enc.trait = 'armored'; RUN.pending = enc; beginFight(enc);")
        await pg.wait_for_timeout(1500)
        # play a card, then end the turn and let the enemy act, then play another
        await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c)); if (i >= 0) playCard(i, alive()[0].uid); renderFightHUD(); })()")
        await pg.evaluate("doEndTurn()"); await pg.wait_for_timeout(6000)
        await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c)); if (i >= 0) playCard(i, alive()[0].uid); renderFightHUD(); })()")
        await pg.wait_for_timeout(300)
        # pause with Escape and save-and-quit
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        before = await pg.evaluate(STATE)
        shown = await pg.evaluate("!document.getElementById('pause').hidden && document.getElementById('pauseH').textContent")
        await pg.screenshot(path='/tmp/pause.png')
        await pg.click('#pSave'); await pg.wait_for_timeout(400)
        title = await pg.evaluate("[UI.screen, document.getElementById('bResume') && document.getElementById('bResume').closest('*').parentElement.textContent.slice(0, 220)]")
        # a fresh page, as if coming back tomorrow
        pg2 = await ctx.new_page(); pg2.on('pageerror', lambda e: errs.append(str(e)))
        await pg2.goto('file://' + ROOT + '/sudden-death.html'); await pg2.wait_for_timeout(500)
        await pg2.click('#bResume'); await pg2.wait_for_timeout(800)
        after = await pg2.evaluate(STATE)
        same = json.loads(before) == json.loads(after)
        print('pause menu:', shown); print('title row:', title[1][:200] if title[1] else title)
        print('restored identically:', same)
        if not same:
            a, c = json.loads(before), json.loads(after)
            for k in a:
                if a[k] != c[k]: print(' ', k, a[k], '->', c[k])
        # the restored fight keeps playing: end turn, enemy acts, no errors
        await pg2.evaluate("doEndTurn()"); await pg2.wait_for_timeout(6000)
        print('after next turn:', await pg2.evaluate("[B.turn, B.phase, B.over || 'on']"))
        await pg2.screenshot(path='/tmp/resumed.png', clip={'x':0,'y':150,'width':1300,'height':700})
        print('errors:', errs)
        await b.close()
asyncio.run(main())

async def closed_tab():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1300,'height':950})
        pg = await ctx.new_page()
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; const enc = rollEncounter('normal'); RUN.pending = enc; beginFight(enc);")
        await pg.wait_for_timeout(1200)
        await pg.evaluate("(() => { const i = B.hand.findIndex(c => canPlay(c)); if (i >= 0) playCard(i, alive()[0].uid); renderFightHUD(); })()")
        await pg.wait_for_timeout(1300)
        before = await pg.evaluate(STATE); await pg.close()
        pg2 = await ctx.new_page(); await pg2.goto('file://' + ROOT + '/sudden-death.html'); await pg2.wait_for_timeout(500)
        await pg2.click('#bResume'); await pg2.wait_for_timeout(600)
        print('closed tab mid-turn, restored identically:', json.loads(before) == json.loads(await pg2.evaluate(STATE)))
        await b.close()
asyncio.run(closed_tab())
