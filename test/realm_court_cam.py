# Realm court camera. The court draws the whole floor while the play crosses it, pushes in on one half once the ball
# and every player are in it, and pulls back out when the play leaves. Drawing only: the camera is not in the game's
# state, a paused game holds its picture, and nobody is ever off the picture while it is pushed in. Asserts; exits
# nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
# the picture now: the camera, the ball's half, and where each player's feet are drawn
LOOK = """(() => { const L = wBK.play, len = wBK.rules.len; return { cam: wBK.cam(), ball: L.ball.x < len / 2 ? 0 : 1,
  xs: L.pl.map(p => Math.round(wBK.scr(p.x, p.y).x)), ys: L.pl.map(p => Math.round(wBK.scr(p.x, p.y).y)), state: JSON.stringify(wBK.G).includes('"cam"') }; })()"""

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
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
        await pg.evaluate("wStartCourt({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'court' && wBK.live")

        # ---------- the whole court to begin with ----------
        a = await pg.evaluate("({ cam: wBK.cam(), o: wBK.scr(0, 0), far: wBK.scr(wBK.rules.len, 0), ph: wBK.phase })")
        check(a['cam']['u'] == 0 and a['cam']['sx'] == 1 and a['o'] == {'x': 60, 'y': 318} and a['far']['x'] == 900, 'the game opens on the whole court', a)

        # ---------- in on a half, each end in turn ----------
        await pg.evaluate("wBK.setMode('watch')")
        seen = []
        for end in (0, 1):
            await pg.wait_for_function(f"wBK.cam().u === 1 && wBK.cam().end === {end} && wBK.phase === 'live'", timeout=120000)
            v = await pg.evaluate(LOOK); seen.append(v)
            check(v['cam']['sx'] == 1.5 and v['ball'] == end, f'the camera pushes in on the half the play is in (end {end})', v)
            check(all(0 <= x <= 960 for x in v['xs']) and all(64 < y < 506 for y in v['ys']), f'pushed in, every player is still in the picture (end {end})', v)
            # a paused game holds its picture
            await pg.evaluate("wBK.pause(true)"); u0 = await pg.evaluate("JSON.stringify(wBK.cam())")
            await pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))")
            u1 = await pg.evaluate("JSON.stringify(wBK.cam())"); await pg.evaluate("wBK.pause(false)")
            check(u0 == u1, f'paused, the picture holds (end {end})', [u0, u1])
            await pg.wait_for_function("wBK.cam().u === 0", timeout=120000)
            w = await pg.evaluate("({ o: wBK.scr(0, 0), sx: wBK.cam().sx })")
            check(w['o'] == {'x': 60, 'y': 318} and w['sx'] == 1, f'and pulls back to the whole court when the play leaves (end {end})', w)
        check(not any(v['state'] for v in seen), 'the camera is not in the game\'s state', None)

        # ---------- a new game starts on the whole court ----------
        await pg.wait_for_function("wBK.cam().u > 0", timeout=120000)
        n = await pg.evaluate("""(() => { const t = wBK.G.teams.map(T => ({ name: T.name, short: T.short, color: T.color, light: T.light, roster: T.roster }));
          wBK.start({ teams: t, seed: 4 }); wBK.render(); return wBK.cam(); })()""")
        check(n['u'] == 0 and n['sx'] == 1, 'a new game starts on the whole court', n)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('FAILS:', len(FAILS)); sys.exit(1 if FAILS else 0)

asyncio.run(main())
