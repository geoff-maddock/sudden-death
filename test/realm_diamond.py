# Realm diamond (issue #4, phase 1): Brimstone Diamond runs inside dist/realm.html in its own scope. None of its
# top-level names (other than ones the Realm declares itself) is visible on the page; its page sits in a shadow root
# inside #v-diamond, so the page still has one #cv and one #pg-play, and its stylesheet leaves the Realm's alone;
# its frame loop is parked until the diamond is shown, and parked again when you leave. An exhibition from the world
# opens the diamond view (the world and the run bar hidden), plays a 3-inning CPU game live, then to a final; the bar
# shows the final, and Back to the world returns to the same tile. In the diamond, Esc is its own Time out (not the
# Realm's pause menu); its End game takes you back to the world. Its keys do nothing in the world. Fits on a phone.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-diamond-*.png.
import asyncio, json, sys, os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

# top-level names of a build's name space file (build.sh writes them for its duplicate check)
def names(path):
    src = open(os.path.join(ROOT, 'build', path)).read()
    return set(m.split()[-1] for m in re.findall(r'^(?:async )?function [A-Za-z_$][\w$]*|^(?:const|let|var) [A-Za-z_$][\w$]*', src, re.M))

SR = "document.getElementById('v-diamond').shadowRoot"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wDiamondExhibition === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    bd, glob = names('realm.scope-wBD.js'), names('realm.global.js')
    private = sorted(bd - glob)
    check(len(private) > 700, 'the diamond scope holds Brimstone Diamond\'s names', len(private))
    async with async_playwright() as p:
        br = await p.chromium.launch()
        # the browser's own names (document, window…) are on every page: the scope stands in for them, it adds none
        blank = await br.new_page(); await blank.goto('about:blank')
        private = await blank.evaluate("names => names.filter(n => !(n in globalThis))", private); await blank.close()
        for tag, vp in (('desk', {'width': 1200, 'height': 900}), ('phone', {'width': 390, 'height': 844})):
            pg = await br.new_page(viewport=vp)
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await boot(pg)
            if tag == 'desk':
                leaked = await pg.evaluate("""names => names.filter(n => { try { return eval('typeof ' + n) !== 'undefined'; } catch (e) { return true; } })""", private)
                check(leaked == [], 'none of Brimstone Diamond\'s own names is visible on the page', leaked[:40])
                check(await pg.evaluate("typeof wBD === 'object' && typeof wBD.start === 'function' && typeof wBD.simToEnd === 'function'"), 'wBD is the only way in')
                ids = await pg.evaluate("({ cv: document.querySelectorAll('#cv').length, play: document.querySelectorAll('#pg-play').length, cvIsSd: document.getElementById('cv') === cv, bdCv: !!" + SR + ".getElementById('cv') })")
                check(ids == {'cv': 1, 'play': 1, 'cvIsSd': True, 'bdCv': True}, 'its #cv and #pg-play live in its shadow root, not the page', ids)
                pad = await pg.evaluate("getComputedStyle(document.body).paddingBottom")
                check(pad != '56px', 'its stylesheet does not style the Realm page', pad)
                t0 = await pg.evaluate("wBD.G.time"); await pg.wait_for_timeout(400)
                check(await pg.evaluate("wBD.G.time") == t0 and not await pg.evaluate("wBD.on"), 'its frame loop is parked while hidden')
            await new_journey(pg)
            at = await pg.evaluate("({ map: WG.map, x: WG.x, y: WG.y })")
            await pg.evaluate("wDiamondExhibition()")
            await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase !== 'menu'")
            v = await pg.evaluate("({ world: document.getElementById('v-world').hidden, run: document.getElementById('runbar').hidden, host: document.getElementById('v-diamond').hidden, bar: document.getElementById('wDiamondBar').hidden, title: document.getElementById('wDiamondTitle').textContent, cpu: wBD.G.teams.map(t => t.ctl), innings: wBD.G.innings, menu: " + SR + ".getElementById('menu').hidden })")
            check(v['world'] and v['run'] and not v['host'] and not v['bar'], f'[{tag}] an exhibition opens the diamond view, the world and run bar hidden', v)
            check(v['cpu'] == ['cpu', 'cpu'] and v['innings'] == 3 and v['menu'] and 'Exhibition' in v['title'], f'[{tag}] a 3-inning CPU game, straight onto the field', v)
            t0 = await pg.evaluate("wBD.G.time"); await pg.wait_for_timeout(600)
            check(await pg.evaluate("wBD.G.time") > t0, f'[{tag}] the game runs live while shown')
            box = await pg.evaluate("(() => { const r = " + SR + ".getElementById('cv').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, sw: document.documentElement.scrollWidth, vw: innerWidth }; })()")
            check(box['w'] > 300 and box['h'] > 180 and box['x'] >= 0 and box['x'] + box['w'] <= box['vw'] + 1 and box['sw'] <= box['vw'], f'[{tag}] the field fits the screen', box)
            await pg.screenshot(path=f'/tmp/realm-diamond-live-{tag}.png')
            if tag == 'desk':
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
                ps = await pg.evaluate("({ realm: UI.paused, bd: !" + SR + ".getElementById('pause').hidden, g: wBD.G.paused })")
                check(not ps['realm'] and ps['bd'] and ps['g'], 'Esc in the diamond is its own Time out, not the Realm\'s pause', ps)
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
                check(await pg.evaluate("!wBD.G.paused && " + SR + ".getElementById('pause').hidden"), 'Esc again plays on')
            await pg.evaluate("wBD.simToEnd(true)")
            await pg.wait_for_function("!!WD && !!WD.over")
            f = await pg.evaluate("({ phase: wBD.G.phase, over: WD.over, runs: wBD.G.teams.map(t => t.R), note: document.getElementById('wDiamondNote').textContent, final: !" + SR + ".getElementById('over').hidden || null })")
            check(f['phase'] == 'over' and f['over']['runs'] == f['runs'] and f['runs'][0] != f['runs'][1] and f['note'].startswith('Final:'), f'[{tag}] it plays to a final, and the bar shows it', f)
            await pg.wait_for_timeout(1700)
            await pg.screenshot(path=f'/tmp/realm-diamond-final-{tag}.png')
            await pg.click('#wDiamondBack'); await pg.wait_for_function("UI.view === 'world'")
            back = await pg.evaluate("({ map: WG.map, x: WG.x, y: WG.y, host: document.getElementById('v-diamond').hidden, bar: document.getElementById('wDiamondBar').hidden, on: wBD.on, wd: WD })")
            check(back == {**at, 'host': True, 'bar': True, 'on': False, 'wd': None}, f'[{tag}] Back to the world: the same tile, the diamond hidden and parked', {'back': back, 'at': at})
            if tag == 'desk':
                # its keys do nothing in the world: T would switch its auto powers, Esc its Time out
                auto = await pg.evaluate("wBD.G.rules && wBD.G.rules.auto")
                await pg.keyboard.press('t'); await pg.wait_for_timeout(100)
                check(await pg.evaluate("!" + SR + ".querySelector('#pause:not([hidden])')"), 'its keys do nothing in the world')
                # End game from its Time out goes back to the world
                await pg.evaluate("wDiamondExhibition({ team: 'mirewood', opp: 'ironmaw' })")
                await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase !== 'menu'")
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
                await pg.evaluate(SR + ".getElementById('bQuit').click()"); await pg.wait_for_timeout(150)
                await pg.evaluate(SR + ".querySelector('[data-end=\"wipe\"]').click()")
                await pg.wait_for_function("UI.view === 'world'")
                check(await pg.evaluate("document.getElementById('v-diamond').hidden && !WD"), 'its End game takes you back to the world')
            check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), f'[{tag}] no page errors', errs + await pg.evaluate("window.__sdErrs"))
            await pg.close()
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond passed')

asyncio.run(main())
