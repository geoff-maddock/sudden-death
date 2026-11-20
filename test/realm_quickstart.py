# Realm Quick start (w112): the simple how-to for each sport, at the top of How to play. Six tabs (golf, baseball,
# football, boxing, basketball, hockey), one pane showing at a time; every step's screenshot is in W_QUICK_IMG and
# loads; every pane has its keys and a link to that sport's full rules, which is there. Each sport's bar has a Quick
# start button that opens How to play on its tab (golf's checked from a real round; baseball's beside Back to the
# world). Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_QUICK !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the page ----------
        await pg.evaluate("showPage('help')")
        await pg.wait_for_selector('#wQuick')
        pg0 = await pg.evaluate("""(() => { const q = document.getElementById('wQuick'), help = document.getElementById('wHelp');
          return { first: q.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false, tabs: [...q.querySelectorAll('[data-wq]')].map(b => b.dataset.wq),
            shown: [...q.querySelectorAll('[data-wqp]')].filter(p => !p.hidden).map(p => p.dataset.wqp) }; })()""")
        check(pg0['first'] and pg0['tabs'] == ['links', 'lanes', 'shed', 'ball', 'grid', 'ring', 'court', 'rink'] and pg0['shown'] == ['links'], 'Quick start is at the top of How to play: eight sports, golf showing', pg0)
        await pg.click('#wQuick [data-wq="rink"]')
        sw = await pg.evaluate("[...document.querySelectorAll('#wQuick [data-wqp]')].filter(p => !p.hidden).map(p => p.dataset.wqp)")
        check(sw == ['rink'], 'a tab shows its sport and hides the others', sw)
        # every step's screenshot: there, and it loads
        await pg.evaluate("document.querySelectorAll('#wQuick [data-wqp]').forEach(p => p.hidden = false)")
        im = await pg.evaluate("""(async () => { const want = W_QUICK.flatMap(s => s.steps.map(st => st.img)), imgs = [...document.querySelectorAll('#wQuick img.wqimg')];
          await Promise.all(imgs.map(i => i.decode().catch(() => null)));
          return { want: want.length, missing: want.filter(id => !W_QUICK_IMG[id]), shown: imgs.length, broken: imgs.filter(i => !(i.naturalWidth > 0)).length }; })()""")
        check(im['missing'] == [] and im['shown'] == im['want'] and im['broken'] == 0, 'every step has its screenshot, and each one loads', im)
        ln = await pg.evaluate("""W_QUICK.map(s => ({ id: s.id, steps: s.steps.length, keys: s.keys.length, more: !!document.getElementById(s.more), phone: !!s.phone }))""")
        check(all(s['steps'] >= 2 and s['keys'] >= 3 and s['more'] and s['phone'] for s in ln), 'each sport has steps, its keys, a word for phones, and a link to its full rules', ln)
        await pg.click('#wQuick [data-wqmore="wRinkHow"]')
        top = await pg.evaluate("Math.round(document.getElementById('wRinkHow').getBoundingClientRect().top)")
        check(abs(top) < 60, 'the full rules link goes to that sport\'s rules', top)

        # ---------- the buttons on each sport's bar ----------
        bt = await pg.evaluate("['links', 'lanes', 'shed', 'ball', 'grid', 'ring', 'court', 'rink'].map(id => !!document.getElementById('wQuick_' + id))")
        check(all(bt), 'every sport\'s bar has a Quick start button', bt)
        await pg.evaluate("showPage('play')")
        await pg.evaluate("wLinksGame({ seed: 3, mode: 'play' })")
        await pg.wait_for_function("UI.view === 'links' && wGL.phase === 'aim'", timeout=20000)
        await pg.click('#wQuick_links')
        op = await pg.evaluate("""(() => ({ page: document.getElementById('pg-help') && !document.getElementById('pg-help').hidden, shown: [...document.querySelectorAll('#wQuick [data-wqp]')].filter(p => !p.hidden).map(p => p.dataset.wqp),
          top: Math.round(document.getElementById('wQuick').getBoundingClientRect().top) }))()""")
        check(op['page'] and op['shown'] == ['links'] and abs(op['top']) < 60, 'Quick start on the golf bar opens How to play on golf', op)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
