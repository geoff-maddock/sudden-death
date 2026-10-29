import asyncio, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import GAME_URL
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1300,'height':950})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_timeout(400)
        r = await pg.evaluate("""(() => { TIPS_SEEN.push(...Object.keys(TIPS)); const out = {};
          // how often maps carry stakes, per act
          newRun('ironmaw',[0,1,2]); out.stakesPerMap = [0,1,2].map(a => { let n = 0; for (let i = 0; i < 30; i++) n += Object.values(genMap(a).nodes).filter(x => x.stakes).length; return (n / 30).toFixed(1); });
          // each perk does what it says (clear any perk startCombat rolled at random, and its head start)
          const fight = (perk, sport) => { newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.pending = null; startCombat(['lb','skelss'], 'normal', sport); B.enemies.forEach(e => delete e.sp); B.sp = null; B.sc.them = 0; B.enemies[0].sp = perk; return B; };
          fight('ace', 'baseball'); scoreThem(1); out.ace = B.sc.them;
          fight('stopper', 'hockey'); out.stopperGoalAt = SKT(mkCard('check')).goal;
          fight('clutch', 'basketball'); B.turn = 3; sportEnemyHit(5); out.clutch = B.sc.them;
          // soccer: a Stopper moves the goal line from 10 to 13; Clutch doubles their goals from turn 3
          fight('stopper', 'soccer'); out.soccerStopper = SKT(mkCard('check')).kick;
          fight('clutch', 'soccer'); B.turn = 3; sportEnemyHit(6); out.soccerClutch = B.sc.them;
          // stakes: lose the game in a grudge match
          newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.pending = { stakes: 'grudge' }; startCombat(['lb'], 'normal', 'hockey'); B.sc.win = false; const d0 = RUN.deck.length; out.grudge = settleStakes().what + ' deck ' + d0 + '->' + RUN.deck.length;
          newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.pending = { stakes: 'wager' }; startCombat(['lb'], 'normal', 'hockey'); B.sc.win = true; const g0 = RUN.gold; settleStakes(); out.wagerWin = RUN.gold - g0;
          return out; })()""")
        for k, v in r.items(): print(k, v)
        # soccer's part asserts (the rest of this check prints)
        bad = [k for k, want in [('soccerStopper', 13), ('soccerClutch', 2)] if r.get(k) != want]
        if bad: print('FAIL soccer perks:', {k: r.get(k) for k in bad})
        # visual: an Ace on the field, and stakes on the map
        await pg.evaluate("newRun('ironmaw',[0,1,2]); RUN.path=[]; RUN.pending = { stakes: 'brutal' }; beginFight({ ids: ['lb','skelss'], type: 'elite', sport: 'hockey', stakes: 'brutal' }); B.enemies[0].sp = 'ace';")
        await pg.wait_for_timeout(1500); await pg.evaluate("A.banner = null"); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/perk.png', clip={'x':55,'y':200,'width':1190,'height':560})
        print('errors:', errs)
        await b.close()
        if bad or errs: sys.exit(1)
asyncio.run(main())
