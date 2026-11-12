# Screenshots of each Realm sport's game screen (baseball, football, boxing, basketball), for art and UI passes:
#   python3 test/realm_sports_shots.py [outdir] [tag]
# writes <outdir>/<tag>-<sport>-<width>.png at desktop (1200) and phone (400) widths. Not a check: it asserts nothing
# but that each screen comes up without a page error. Take a "before" set, change the screens, take an "after" set.
import asyncio, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/realm-sports'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'shot'
CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

# each sport: how to start it, what to wait for, and the moments to shoot (name, script to reach it)
SPORTS = {
    'ball': ("wStartBall({ club: 'local', how: 'play' })", "UI.view !== 'world'", [('start', '0')]),
    'grid': ("wStartGrid({ club: 'local', how: 'manage' })", "UI.view === 'gridiron' && wGF.phase === 'call'",
             [('call', '0'), ('live', "wGF.setMode('watch')")]),
    'ring': ("W_RING_MODE = 'play'; wRingBout({ kinds: ['gorgon', 'ogre'], seed: 9 })", "UI.view !== 'world'",
             [('start', '0'), ('round', "wBX.wait && wBX.call(wBX.wait.plan)")]),
    'court': ("wStartCourt({ club: 'local', how: 'manage' })", "UI.view === 'court' && wBK.live",
              [('start', '0'), ('watch', "wBK.setMode('watch')")]),
}

async def shoot(br, sport, w, h):
    start, ready, moments = SPORTS[sport]
    pg = await br.new_page(viewport={'width': w, 'height': h})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wStartCourt === 'function'")
    await pg.evaluate("SET.tips = false; SET.sfx = false; SET.music = false")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
    await pg.evaluate("(() => { for (const kind of ['troll', 'harpy']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
    await pg.evaluate(CLOSE_ALL)
    await pg.evaluate(start)
    await pg.wait_for_function(ready, timeout=30000)
    for name, js in moments:
        await pg.evaluate(js)
        await pg.wait_for_timeout(2500)
        f = os.path.join(OUT, f'{TAG}-{sport}-{name}-{w}.png')
        await pg.screenshot(path=f, full_page=True)
        print(f)
    if errs: print('PAGE ERRORS', sport, errs)
    await pg.close()
    return errs

async def main():
    os.makedirs(OUT, exist_ok=True)
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else list(SPORTS)
    bad = []
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for sport in only:
            for w, h in ((1200, 900), (400, 800)):
                try: bad += await shoot(br, sport, w, h)
                except Exception as e: print('FAILED', sport, w, str(e)[:300]); bad.append(str(e))
        await br.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
