# Realm gridiron view: the field fills the page's width, and the page widens on a big screen, but the game's bar and
# the whole field fit in the window (the page scrolls the bar to the top; the field is never smaller than 960 wide); the canvas draws at the size it is shown; on a big play the camera zooms in on the ball and
# comes back out by the next call; after a play a banner says what it came to; the team stats show under the field
# once there are plays; How it works explains them. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); } })()"""
SIZES = """(() => { const cv = document.querySelector('#v-gridiron canvas'), m = document.querySelector('main').getBoundingClientRect(), r = cv.getBoundingClientRect();
  return { main: m.width, cw: r.width, bottom: r.bottom - document.getElementById('wGridBar').getBoundingClientRect().top, inView: r.bottom <= innerHeight + 1, px: cv.width, win: innerHeight }; })()"""

async def start(br, w, h, scale=1):
    pg = await br.new_page(viewport={'width': w, 'height': h}, device_scale_factor=scale)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wStartGrid === 'function'")
    await pg.evaluate("SET.tips = false")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
    await pg.evaluate("(() => { for (const kind of ['troll', 'harpy']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
    await pg.evaluate(CLOSE_ALL)
    await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
    await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
    await pg.wait_for_timeout(300)
    return pg, errs

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()

        # ---------- the field's size ----------
        got = {}
        for w, h in ((1280, 800), (1920, 1080), (2560, 1440)):
            pg, errs = await start(br, w, h)
            got[w] = await pg.evaluate(SIZES)
            g = got[w]; fits = g['bottom'] <= g['win'] + 1 and g['inView']
            check(fits or g['cw'] <= 961, f'at {w} wide the game\'s bar and the whole field are in the window (or the field is at its smallest, 960)', g)
            check(abs(g['cw'] - g['main']) < 2 or g['win'] - g['bottom'] < 20, f'at {w} wide the field fills the page\'s width, or the window\'s height', g)
            check(not errs, f'no page errors at {w}', errs)
            if w != 2560: await pg.close()
        check(got[1920]['cw'] > 1100 and got[2560]['cw'] > got[1920]['cw'] + 300, 'a bigger screen gets a bigger field', got)
        check(got[2560]['px'] >= got[2560]['cw'] - 2, 'the canvas draws at the size it is shown (sharp)', got[2560])
        await pg.evaluate("showView('world')")
        check(await pg.evaluate("!document.body.classList.contains('wgwide')"), 'the page is its usual width again off the gridiron')
        await pg.close()
        pg, errs = await start(br, 2560, 1440, 2)
        d = await pg.evaluate("[wGF.view().px, document.querySelector('#v-gridiron canvas').width]")
        check(d[0] == 2.5 and d[1] == 2400, 'on a dense big screen the canvas stops at 2.5 device pixels per canvas pixel', d)
        await pg.close()

        # ---------- the zoom, the banner and the stats ----------
        pg, errs = await start(br, 1600, 1000)
        await pg.evaluate("wGF.setMode('watch')")
        await pg.wait_for_function("wGF.view().zoom > 1.5", timeout=120000)
        v = await pg.evaluate("wGF.view()")
        check(v['why'] in ('Breakaway!', 'Deep ball!', 'Broken tackle!', 'At the goal line!', 'Touchdown!', 'Picked off!'), 'a big play zooms in on the ball, and says why', v)
        await pg.wait_for_function("wGF.phase === 'call' || wGF.phase === 'kickoff'", timeout=60000)
        await pg.wait_for_timeout(1500)
        check(await pg.evaluate("wGF.view().zoom < 1.05"), 'by the next call the camera is back out', await pg.evaluate("wGF.view()"))
        await pg.wait_for_function("wGF.phase === 'post' && !!wGF.view().big", timeout=120000)
        v = await pg.evaluate("wGF.view()")
        check(v['big']['k'] in ('td', 'int', 'first', 'sack', 'safety', 'downs', 'long', 'fg', 'miss'), 'after a play, a banner says what it came to', v)
        stats = await pg.evaluate("document.getElementById('wGridStats').textContent")
        check('Total yards' in stats and 'Passing' in stats and 'Leaders' in stats, 'the team stats and leaders show under the field', stats)
        how = await pg.evaluate("document.getElementById('wGridHow').textContent")
        check('zooms in on the ball' in how and 'banner' in how and 'leaders' in how, 'How it works explains the zoom, the banner and the stats')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
