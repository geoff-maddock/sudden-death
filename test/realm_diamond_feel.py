# Realm baseball feel (issue #4, phase 7): on the diamond Sudden Death's music stops and Brimstone Diamond's sound
# follows the Music and Sound effects settings (both on, then both off); a coach's note says when your team can play
# ball, another the Diamond Cup after your first win; a won ball game and a won Diamond Cup count for their medals.
# How to play says so. Asserts; exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wBallOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBallTips === 'function'")
        # every note seen but the two under test
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS).filter(k => k !== 'w_ball' && k !== 'w_dcup')); SET.tips = true")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the coach's notes ----------
        await pg.wait_for_timeout(1000)
        check(not await pg.evaluate("TIPS_SEEN.includes('w_ball') || tipQ.includes('w_ball')"), 'no Play ball note with three players')
        await pg.evaluate("wRecruit({ kind: 'troll', lvl: 2 }, 'tavern'); wRecruit({ kind: 'harpy', lvl: 2 }, 'tavern')")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_ball') || TIPS_SEEN.includes('w_ball')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Play ball' in coach and 'Nine tab' in coach, 'with five players, a coach\'s note says how to play ball', coach)
        await pg.click('#cOk')

        # ---------- sound on the diamond ----------
        await pg.mouse.click(5, 5)  # a gesture, so audio may start
        await pg.evaluate("SET.music = true; SET.sfx = true")
        await pg.evaluate("wStartBall({ club: 'local', how: 'play' })")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live", timeout=15000)
        await pg.wait_for_timeout(1200)
        s = await pg.evaluate("({ sd: !!MUS.timer, bd: wBD.sound })")
        check(not s['sd'] and s['bd'] == {'music': True, 'sfx': True}, "on the diamond: Sudden Death's music is off, the ballpark's follows the settings (on)", s)
        await pg.wait_for_function("!!WG.ball.live.snap", timeout=15000)
        await pg.click('#wBallSave'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("SET.music = false; SET.sfx = false; wResumeBall()")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.live", timeout=15000)
        s = await pg.evaluate("wBD.sound")
        check(s == {'music': False, 'sfx': False}, 'and with music and sound off, the ballpark is quiet too', s)

        # ---------- medals ----------
        w0 = await pg.evaluate("ACHS.stats.realmBallWins || 0")
        await pg.evaluate("wBD.G.teams[0].R += 30; wBD.G.teams.forEach(t => t.ctl = 'cpu'); wBD.simToEnd(true)")
        await pg.wait_for_function("!WG.ball.live")
        check(await pg.evaluate("WG.ball.games[0].r") == 'win' and await pg.evaluate("ACHS.stats.realmBallWins || 0") == w0 + 1, 'a won ball game counts for the Play Ball medal')
        await pg.click('#wDiamondBack'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_dcup') || TIPS_SEEN.includes('w_dcup')", timeout=5000)
        check(True, 'after a win, a coach\'s note points to the Diamond Cup')
        d0 = await pg.evaluate("ACHS.stats.realmDcups || 0")
        await pg.evaluate("""(() => { WG.dcup = { week: wWeek(), field: ['me'], round: 2, games: [[], [], [{ a: 'me', b: 'wild:plains', ra: 3, rb: 1, w: 'me' }]], done: true, champ: 'me' }; wDcupWon(); })()""")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("ACHS.stats.realmDcups || 0") == d0 + 1 and await pg.evaluate("ACH.some(a => a.id === 'w_dcup') && ACH.some(a => a.id === 'w_ball')"), 'a won Diamond Cup counts for its medal; both medals are in the book')

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpBallFeel'); return h ? h.textContent : ''; })()")
        check('organ' in help_ and 'medals' in help_, 'How to play mentions the sound and the medals', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond feel passed')

asyncio.run(main())
