# A full hand (10 cards) fits its space at every width: no card covers End turn or the piles, none runs off the
# screen, and the page never scrolls sideways. Resizing the window refits the hand. Asserts; exits nonzero.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import GAME_URL, GAME_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:500]))
    if not ok: FAILS.append(what)

FULL = """(() => { TIPS_SEEN.push(...Object.keys(TIPS)); newRun('ironmaw', [0, 1, 2]); RUN.path = []; RUN.clock = 1;
  startCombat(['skelss', 'lb'], 'normal', 'golf'); while (B.hand.length < 10) B.hand.push(B.draw.pop() || B.discard.pop() || B.hand[0]);
  showView('fight'); renderFightHUD(); })()"""
LOOK = """(() => { const top = id => { const r = document.getElementById(id).getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el && (el.closest('#' + id) ? id : el.closest('.card') ? 'a card' : el.id || el.className); };
  const cards = [...document.querySelectorAll('#hand .card')].map(e => e.getBoundingClientRect());
  return { n: cards.length, end: top('bEnd'), draw: top('pDraw'), disc: top('pDisc'), left: Math.round(Math.min(...cards.map(r => r.left))),
    right: Math.round(Math.max(...cards.map(r => r.right))), vw: innerWidth, scroll: document.documentElement.scrollWidth }; })()"""

async def main():
    subprocess.run(GAME_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        errs = []
        for w in [1400, 1100, 900, 700, 400]:
            pg = await br.new_page(viewport={'width': w, 'height': 900})
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(GAME_URL); await pg.wait_for_function("typeof newRun === 'function'")
            await pg.evaluate(FULL)
            r = await pg.evaluate(LOOK)
            check(r['n'] == 10 and r['end'] == 'bEnd' and r['draw'] == 'pDraw' and r['disc'] == 'pDisc', f'{w}px: no card covers End turn or the piles', r)
            check(r['left'] >= 0 and r['right'] <= r['vw'] and r['scroll'] <= r['vw'], f'{w}px: every card is on the screen, no sideways scroll', r)
            await pg.close()
        # resize with the hand out: it refits
        pg = await br.new_page(viewport={'width': 1400, 'height': 900})
        await pg.goto(GAME_URL); await pg.wait_for_function("typeof newRun === 'function'")
        await pg.evaluate(FULL)
        await pg.set_viewport_size({'width': 700, 'height': 900})
        await pg.wait_for_function("document.documentElement.scrollWidth <= innerWidth")
        r = await pg.evaluate(LOOK)
        check(r['left'] >= 0 and r['right'] <= r['vw'] and r['end'] == 'bEnd', 'after a resize the hand refits', r)
        # a small hand keeps the usual spacing
        n = await pg.evaluate("(() => { B.hand.length = 4; renderHand(); return getComputedStyle(document.querySelector('#hand .card')).marginLeft; })()")
        cw = await pg.evaluate("document.querySelector('#hand .card').offsetWidth")
        check(abs(float(n[:-2]) + cw * .1) < 1, 'a small hand keeps the usual overlap', [n, cw])
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
