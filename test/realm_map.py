# Realm map (w37): the world map is revealed as you walk it and stays revealed. A new journey knows only round
# Graftonbury; walking the world reveals round each step; a place's mark shows once its tile is seen; the fog is
# plain JSON in WG and survives a save and reload; an older save without it is revealed round the places it has been;
# M, the HUD button and the Menu open the map; How to play has the section.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-map-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
MAP_OPEN = "!document.getElementById('modal').hidden && !!document.getElementById('wMapCv')"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_MAP !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(CLOSE_ALL)

        # ---------- a new journey ----------
        s = await pg.evaluate("""(() => { const g = DB.locs.find(l => l.id === 'graftonbury'), far = DB.locs.find(l => l.id === 'cinderhold');
          return { fog: typeof WG.fog, n: wMapSeenCount(), home: wFogSeen(g.x, g.y), far: wFogSeen(far.x, far.y),
            places: wMapPlaces().map(L => L.id) }; })()""")
        check(s['fog'] == 'string', 'the fog is a plain string in WG', s)
        check(s['home'] and not s['far'] and 0 < s['n'] < 200, 'a new journey knows round Graftonbury and nothing far off', s)
        check('graftonbury' in s['places'] and 'cinderhold' not in s['places'], 'only seen places get a mark', s)

        # ---------- walking reveals ----------
        w = await pg.evaluate("""(() => { const g = DB.locs.find(l => l.id === 'graftonbury'); wEnterMap('world', g.x, g.y + 1); wDrain();
          const n0 = wMapSeenCount(), x0 = WG.x, y0 = WG.y; let steps = 0;
          for (let i = 0; i < 12; i++) { if (wDoStep(1, 0)) steps++; else if (wDoStep(0, 1)) steps++; }
          return { n0, n1: wMapSeenCount(), steps, moved: WG.x !== x0 || WG.y !== y0, here: wFogSeen(WG.x, WG.y),
            json: JSON.parse(JSON.stringify(WG)).fog === WG.fog }; })()""")
        check(w['moved'] and w['n1'] > w['n0'] and w['here'], 'walking the world reveals the tiles round you', w)
        check(w['json'], 'the fog survives JSON', w)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = DB.locs.find(l => l.id === 'cinderhold');
          const before = wFogSeen(L.x, L.y); wEnterMap('world', L.x, L.y + 1); wDrain();
          return { before, after: wFogSeen(L.x, L.y), mark: wMapPlaces().some(p => p.id === 'cinderhold') }; })()""")
        check(not r['before'] and r['after'] and r['mark'], 'arriving somewhere reveals it, and its mark shows', r)
        await pg.evaluate(CLOSE_ALL)

        # ---------- save and reload ----------
        n_before = await pg.evaluate("(wSave(), wMapSeenCount())")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_MAP !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("!!WG && UI.view === 'world'", timeout=10000)
        await pg.evaluate(CLOSE_ALL)
        n_after = await pg.evaluate("wMapSeenCount()")
        check(n_after >= n_before, 'what you have seen stays seen after a save and reload', [n_before, n_after])

        # ---------- an older save ----------
        old = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); delete save.WG.fog;
          save.WG.flags.seen_saltmere = 1; wStart(save); const L = DB.locs.find(l => l.id === 'saltmere');
          return { fog: typeof WG.fog, salt: wFogSeen(L.x, L.y) }; })()""")
        check(old['fog'] == 'string' and old['salt'], 'an older save is revealed round the places it has been', old)
        await pg.evaluate(CLOSE_ALL)

        # ---------- opening it ----------
        await pg.wait_for_function("wActive()")
        await pg.keyboard.press('m')
        check(await pg.evaluate(MAP_OPEN), 'M opens the map')
        info = await pg.evaluate("""(() => { const cv = document.getElementById('wMapCv'), t = document.getElementById('modalBox').textContent;
          return { w: cv.width, h: cv.height, pct: /seen \\d+% of the realm/.test(t) }; })()""")
        check(info['w'] == 96 * 8 and info['h'] == 72 * 8 and info['pct'], 'the map draws the whole world and says how much is seen', info)
        await pg.screenshot(path='/tmp/realm-map-open.png')
        await pg.keyboard.press('Escape')
        await pg.wait_for_function("document.getElementById('modal').hidden")
        await pg.evaluate("wRenderHud()")
        await pg.click('#wMapBtn')
        check(await pg.evaluate(MAP_OPEN), 'the Map button in the HUD opens the map')
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("wActive()")
        await pg.evaluate("wOpenMenu()")
        await pg.wait_for_selector('#pMap', state='visible')
        await pg.click('#pMap')
        check(await pg.evaluate(MAP_OPEN + " && !UI.paused"), 'the Menu has a Map button that opens the map')
        await pg.evaluate(CLOSE_ALL)

        # ---------- How to play ----------
        await pg.evaluate("renderHelp()")
        check(await pg.evaluate("!!document.getElementById('wHelpMap')"), 'How to play explains the map')

        await pg.set_viewport_size({'width': 390, 'height': 844})
        await pg.evaluate("wOpenMap()")
        sw = await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        check(sw, 'the map fits a phone screen with no sideways scroll')
        await pg.screenshot(path='/tmp/realm-map-phone.png')

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
