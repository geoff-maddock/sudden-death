"""A household name (issue #79, phase 6): at the top step of your following, tavern free agents ask a quarter less,
cup entry fees are waived (town cups, the Diamond Cup, the four engine cups), and a rival's bid is half as much again.
Back under the step they are as they were. Not in LAB mode."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:600])
    else:
        print('ok', what)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wFameOn === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        f = await pg.evaluate("""(() => { const fees = () => W_FAME.cups.map(T => T.fee); RUN.fans = 1499; const below = fees(), bid0 = W_LEAGUE.fee(3), on0 = wFameOn();
          RUN.fans = 1500; const at = fees(), bid1 = W_LEAGUE.fee(3), on1 = wFameOn();
          LAB = true; let lab; try { lab = fees(); } finally { LAB = false; }
          W_KETTLE.fee = 55; const set = [W_KETTLE.fee, (RUN.fans = 0, W_KETTLE.fee)]; W_KETTLE.fee = 40;
          return { below, at, bid0, bid1, on0, on1, lab, set, n: W_FAME.cups.length }; })()""")
        check(f['n'] == 6 and all(x > 0 for x in f['below']) and f['at'] == [0] * 6 and not f['on0'] and f['on1'], 'a household name pays no cup entry fee, in all six cups; one fan short pays them all', f)
        check(f['bid1'] == round(f['bid0'] * 1.5) and f['lab'] == f['below'] and f['set'] == [0, 55], 'a rival bids half as much again; nothing in LAB mode; a fee can still be set', f)
        c = await pg.evaluate("""(() => { RUN.fans = 1600; RUN.gold = 0; WG.hkcup = null; const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          const probs = wKettleProblems(), r = wKettleEnter(), on = wKettleOn(), gold = RUN.gold; WG.hkcup = null; RUN.fans = 100; const poor = wKettleProblems().join(' ');
          return { probs, r, on, gold, poor }; })()""")
        check(c['probs'] == [] and c['r'] == '' and c['on'] and c['gold'] == 0 and 'entry fee is 40 gold' in c['poor'], 'with no gold a household name still enters the Pond Kettle; without the name the fee is asked', c)
        t = await pg.evaluate("""(() => { RUN.fans = 100; WG.tavern = {}; const plain = wTavern('mossgate').list.map(a => a.fee);
          RUN.fans = 1500; WG.tavern = {}; const T = wTavern('mossgate'), fame = T.list.map(a => [a.fee, wFee(a.lvl)]), again = wTavern('mossgate').list.map(a => a.fee);
          return { plain, fame, again, mark: T.wfame }; })()""")
        check(t['mark'] == 1 and all(a[0] == round(a[1] * .75) for a in t['fame']) and t['again'] == [a[0] for a in t['fame']], 'tavern free agents ask a quarter less, once', t)
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpFame'); return h ? h.textContent : ''; })()")
        check('A household name' in hp and 'quarter less' in hp and 'waived' in hp, 'How to play explains a household name', hp)
        live = await pg.evaluate("W_FOLLOW.live")
        check(live == [False, True, True, True, True], 'every step is marked as in the game', live)
        team = await pg.evaluate("(() => { RUN.fans = 10; return wCampTeam().includes('(Coming.)'); })()")
        check(not team, 'the Team screen no longer says anything is coming')
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
