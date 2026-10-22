import asyncio, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from playwright.async_api import async_playwright
WIN = """(() => { beginFight({ ids: ['lb'], type: 'elite', sport: 'baseball' }); A.banner = null; B.energy = 9; B.sc.bases = [1,1,1];
  const c = mkCard('check'); B.hand.unshift(c); B.P.st.str = 20; playCard(0, B.enemies[0].uid);
  B.enemies.forEach(e => { e.hp = 0; e.dead = true; }); B.over = 'win'; sportFinal(); finishFight(); RUN.panel = null; })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1300,'height':1000})
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        # Guest plays a run: goals climb tiers, achievements unlock
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.goals = { 0: [{ id: 'clean', tier: 0, done: false }, { id: 'reel', tier: 0, done: false }] };")
        for i in range(3): await pg.evaluate(WIN); await pg.wait_for_timeout(200)
        g = await pg.evaluate("RUN.goals[0].map(x => x.id + ' tier ' + x.tier + (x.done ? ' done' : ''))")
        a = await pg.evaluate("Object.entries(ACHS.got).map(([k, t]) => k + ':' + MEDAL[t])")
        toast = await pg.evaluate("document.getElementById('achToast') && document.querySelector('#achToast b').textContent")
        await pg.evaluate("recordRun('win'); showPage('rec')"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/ach_rec.png', full_page=True)
        guestRuns = await pg.evaluate("loadRecords().runs.length")
        # create a profile: it starts empty, and the guest's progress stays put
        await pg.evaluate("showPage('play'); renderTitle()"); await pg.wait_for_timeout(200)
        await pg.click('#bProfile'); await pg.fill('#newProf', 'Cutups'); await pg.click('#bMkProf'); await pg.wait_for_timeout(800)
        p2 = await pg.evaluate("[profileName(), loadRecords().runs.length, Object.keys(ACHS.got).length, !!loadRun()]")
        await pg.screenshot(path='/tmp/prof_title.png')
        await pg.click('#bProfile'); await pg.wait_for_timeout(200); await pg.screenshot(path='/tmp/prof_modal.png')
        await pg.click('[data-play=guest]'); await pg.wait_for_timeout(800)
        back = await pg.evaluate("[profileName(), loadRecords().runs.length, Object.keys(ACHS.got).length]")
        print('goal ladder:', g); print('achievements:', a, '| toast:', toast)
        print('guest runs:', guestRuns, '| new profile [name, runs, medals, run saved]:', p2, '| back to guest:', back); print('errors:', errs)
        await b.close()
asyncio.run(main())

async def midrun():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1300,'height':950})
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/sudden-death.html'); await pg.wait_for_timeout(400)
        async with pg.expect_navigation(): await pg.evaluate("setTimeout(() => switchProfile(createProfile('Ana')), 0)")
        await pg.wait_for_timeout(500)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); newRun('frostfang',[0,1,2]); RUN.path=[]; const enc = rollEncounter('normal'); RUN.pending = enc; beginFight(enc);"); await pg.wait_for_timeout(1500)
        inFight = await pg.evaluate("[document.getElementById('whoName').textContent, B.turn, B.hand.map(c => c.id).join(',')]")
        await pg.screenshot(path='/tmp/who_fight.png', clip={'x':0,'y':0,'width':1300,'height':120})
        await pg.click('#bWho'); await pg.wait_for_timeout(200)
        async with pg.expect_navigation(): await pg.click('[data-play=guest]')
        await pg.wait_for_timeout(500)
        guest = await pg.evaluate("[document.getElementById('whoName').textContent, !!loadRun() && loadRun().club]")
        async with pg.expect_navigation(): await pg.evaluate("setTimeout(() => switchProfile(PROFILES.list.find(p => p.name === 'Ana').id), 0)")
        await pg.wait_for_timeout(500)
        await pg.click('#bResume'); await pg.wait_for_timeout(700)
        back = await pg.evaluate("[document.getElementById('whoName').textContent, B && B.turn, B && B.hand.map(c => c.id).join(',')]")
        print('in fight as Ana:', inFight[0], '| switched to guest:', guest, '| back as Ana, same fight:', back[0], back[1] == inFight[1] and back[2] == inFight[2], '| errors:', errs)
        await b.close()
asyncio.run(midrun())
