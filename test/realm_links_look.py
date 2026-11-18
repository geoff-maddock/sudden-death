# Realm links: what's on the hole (the hole inspector, 13-inspect.js). wGL.look(x, y) says what is at a point: the
# enchantment or wood's way whose reach it is in (the same reach its effect uses), then the ground; wGL.holeGuide()
# lists everything on the hole once. Each has plain words, says whether it helps or troubles a ball, and the kind it
# spares, naming your player of that kind. A mouse over the course shows the note; This hole on the bar lists them
# (the game waits while it is up); How to play and the Quick start say so. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # a round with the wood and the enchanted course on (as the Realm's are), your four with an elf
        await pg.evaluate("""(() => { const T = wLinksTeams(); T[0].roster[0].kind = 'elf'; T[0].roster[0].n = 'Ithil';
          wLinksGame({ seed: 11, mode: 'play', teams: T }); wGL.pause(true); let i = 0; while (wGL.phase !== 'aim' && i++ < 8000) wGL.tick(0.05); })()""")
        gd = await pg.evaluate("wGL.holeGuide()")
        ks = [g['k'] for g in gd]
        check('bees' in ks and 'wyvern' in ks and 'wisp' in ks and 'ent' in ks and 'web' in ks and 'rune' in ks and len(ks) == len(set(ks)), 'This hole lists everything on it, once each', ks)
        check(all(g['n'] and len(g['t']) > 20 and g['good'] in (True, False, None) for g in gd), 'each with a name, plain words, and whether it helps or troubles a ball', gd[:3])
        wv = next(g for g in gd if g['k'] == 'wyvern')
        check('gorgon' in wv['t'], 'the kind it spares is named', wv)
        # at a point: the spot's own reach, nearest first, then the ground
        at = await pg.evaluate("""(() => { const S = wGL.spots(), bees = S.find(s => s.k === 'bees'), rune = S.find(s => s.k === 'rune');
          const off = { x: bees.x + bees.r + 2, y: bees.y };
          return { bees: wGL.look(bees.x, bees.y).map(i => i.k), edge: wGL.look(bees.x + bees.r - 0.5, bees.y).map(i => i.k), off: wGL.look(off.x, off.y).map(i => i.k),
            rune: wGL.look(rune.x, rune.y).find(i => i.k === 'rune'), lie: wGL.lie ? null : null }; })()""")
        check(at['bees'][0] == 'bees' and 'bees' in at['edge'] and 'bees' not in at['off'], 'a point inside the hive\'s reach says Beehive, just outside it doesn\'t (the reach its sting uses)', at)
        check(at['rune']['good'] is True, 'the runestone is a help', at['rune'])
        gr = await pg.evaluate("(() => { const H = wGL.course(wGL.G.h), t = H.tee; return wGL.look(t.x, t.y).map(i => i.k); })()")
        check(gr[-1] == 'T', 'and the ground under a point (the tee)', gr)
        rg = await pg.evaluate("(() => { const S = wGL.spots().find(s => s.k === 'rings'); return S ? wGL.look(S.x, S.y).find(i => i.k === 'rings').t : 'none'; })()")
        check(rg == 'none' or 'Ithil is one of yours' in rg, 'a fairy ring names your elf, the kind it spares', rg)

        # a mouse over the course: the note
        # (the camera settles first; then whichever thing is in view, away from the bar and the meter)
        await pg.wait_for_function("(() => { const v = JSON.stringify(wGL.scr(0, 0)); const ok = window.__cam === v; window.__cam = v; return ok; })()", polling=200, timeout=10000)
        mv = await pg.evaluate("""(() => { const cv = document.querySelector('#v-links canvas'), r = cv.getBoundingClientRect();
          for (const s of wGL.spots()) { const [sx, sy] = wGL.scr(s.x, s.y); if (sx > 40 && sx < 920 && sy > 110 && sy < 500) return { x: r.left + sx * r.width / 960, y: r.top + sy * r.height / 600, n: wGL.look(s.x, s.y)[0].n }; }
          return null; })()""")
        check(mv is not None, 'something on the hole is in view to point at', mv)
        await pg.mouse.move(mv['x'], mv['y'])
        await pg.wait_for_function("(() => { const e = document.querySelector('.gllook'); return e && !e.hidden; })()", timeout=5000)
        tt = await pg.evaluate("document.querySelector('.gllook').textContent")
        check(mv['n'] in tt, 'a mouse over it shows its note', [mv['n'], tt])
        await pg.mouse.move(5, 5)
        await pg.wait_for_function("document.querySelector('.gllook').hidden", timeout=5000)
        check(True, 'and it goes when the mouse leaves the course')

        # This hole: the list, and the game waits
        await pg.evaluate("wGL.pause(false)")
        await pg.click('#wLinksHole')
        await pg.wait_for_function("!document.getElementById('modal').hidden")
        bx = await pg.evaluate("(() => { const t = document.getElementById('modalBox').textContent, ph = wGL.phase; return { t: t.slice(0, 200), has: t.includes('Beehive') && t.includes('The wyvern'), ph }; })()")
        await pg.wait_for_timeout(600)
        ph2 = await pg.evaluate("wGL.phase")
        check(bx['has'] and bx['ph'] == 'aim' and ph2 == 'aim', 'This hole on the bar lists them, and the game waits while it is up', bx)
        await pg.click('#modalBox [data-close]')
        await pg.wait_for_function("document.getElementById('modal').hidden")

        # the words: How to play and the Quick start
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("""(() => ({ help: ((document.getElementById('wHelpLinksLook') || {}).textContent || '').includes('This hole'),
          quick: (document.querySelector('#wQuick [data-wqp="links"]') || {}).textContent.includes('Point at anything') }))()""")
        check(hp['help'] and hp['quick'], 'How to play and the Quick start say how to look', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
