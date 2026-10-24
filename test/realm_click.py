# Realm click to act: clicking plain ground walks there and does nothing else; clicking a thing you can look at but not
# stand on (a painting) walks up to it, faces it and looks at it; clicking a person walks up and talks to them; a
# click on a person or a thing next to you acts at once; somebody behind a counter is talked to across it; something out of reach is looked at from where you stand.
# The pointer is a hand over things a click would act on. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-click.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wCanvasClick === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

# where tile (x, y) is on screen, once the camera has settled
async def at(pg, x, y):
    await pg.wait_for_timeout(250)
    return await pg.evaluate(f"(() => {{ const r = WUI.cv.getBoundingClientRect(); return [r.left + ({x} + .5 - WUI.cam[0]) * WTILE * WUI.zoom, r.top + ({y} + .5 - WUI.cam[1]) * WTILE * WUI.zoom]; }})()")

async def click_tile(pg, x, y):
    cx, cy = await at(pg, x, y)
    await pg.mouse.click(cx, cy)
    await pg.wait_for_function("!WUI.goto", timeout=10000)
    await pg.wait_for_timeout(100)

LAST = "WLOG.length ? WLOG[WLOG.length - 1][0] : ''"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await new_journey(pg)
        await pg.evaluate("wEnterMap('graftonbury', 5, 12); WG.grace = 99; wCloseTalk(); wDrain()")

        # plain ground: walk there, nothing else
        n0 = await pg.evaluate("WLOG.length")
        await click_tile(pg, 9, 12)
        pos = await pg.evaluate("({ x: WG.x, y: WG.y, talk: !!WUI.talk, looks: WLOG.slice(%d).filter(l => l[1] === 'd').length })" % n0)
        check(pos['x'] == 9 and pos['y'] == 12 and not pos['talk'] and pos['looks'] == 0, 'plain ground: you walk there and nothing else', pos)

        # a painting in the League office: walk up to it and look
        P = await pg.evaluate("(() => { const m = MAPS.graftonbury; for (let y = 0; y < m.h; y++) for (let x = 0; x < 9; x++) if (m.t[y][x] === 'P') return [x, y]; return null; })()")
        cx, cy = await at(pg, *P)
        await pg.mouse.move(cx, cy); await pg.wait_for_timeout(50)
        check(await pg.evaluate("WUI.cv.style.cursor") == 'pointer', 'the pointer is a hand over the painting')
        await click_tile(pg, *P)
        r = await pg.evaluate("({ x: WG.x, y: WG.y, face: WG.face, last: %s })" % LAST)
        adj = abs(r['x'] - P[0]) + abs(r['y'] - P[1]) == 1
        check(adj and r['last'].startswith('The painting:'), 'a painting: you walk up to it and look at it', {'P': P, 'r': r})
        await pg.screenshot(path='/tmp/realm-click.png')

        # a person: walk up and talk (Imelda Foss, behind her counter)
        await pg.evaluate("wCloseTalk(); wEnterMap('graftonbury', 18, 12); wDrain()")
        npc = await pg.evaluate("(() => { const n = MAPS.graftonbury.npcs.find(n => n.id === 'vesper'); return [n.x, n.y]; })()")
        await click_tile(pg, *npc)
        t = await pg.evaluate("({ talk: WUI.talk && WUI.talk.id, x: WG.x, y: WG.y })")
        check(t['talk'] == 'vesper', 'a person: you walk up and talk to them', {'npc': npc, 't': t})

        # behind a counter: walk to the counter in front of them and talk (Imelda Foss, the League clerk)
        await pg.evaluate("wCloseTalk(); wEnterMap('graftonbury', 7, 8); wDrain()")
        clerk = await pg.evaluate("(() => { const n = MAPS.graftonbury.npcs.find(n => n.id === 'clerk'); return [n.x, n.y]; })()")
        await click_tile(pg, *clerk)
        t = await pg.evaluate("({ talk: WUI.talk && WUI.talk.id, x: WG.x, y: WG.y })")
        check(t['talk'] == 'clerk', 'somebody behind a counter: you walk to the counter and talk to them', {'clerk': clerk, 't': t})

        # next to you: at once
        await pg.evaluate("wCloseTalk(); wDrain()")
        S = await pg.evaluate("(() => { const m = MAPS.graftonbury; for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (m.t[y][x] === 'S' && y > 18) return [x, y]; } return null; })()")
        stand = await pg.evaluate(f"(() => {{ const m = MAPS.graftonbury; for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {{ const x = {S[0]} + dx, y = {S[1]} + dy, c = wTileAt(m, x, y); if (c && DB.tiles[c].walk && !DB.tiles[c].enter && !wNpcAt(x, y)) return [x, y]; }} return null; }})()")
        await pg.evaluate(f"wEnterMap('graftonbury', {stand[0]}, {stand[1]}); wCloseTalk(); wDrain()")
        await click_tile(pg, *S)
        r = await pg.evaluate("({ x: WG.x, y: WG.y, last: %s })" % LAST)
        check([r['x'], r['y']] == stand and r['last'].startswith('The sign reads:'), 'a sign next to you: read at once, without moving', {'S': S, 'r': r})

        # out of reach: looked at from here (the lake beyond Saltmere's docks is walked to, so use a rock in the lava at Cinderhold)
        await pg.evaluate("wEnterMap('cinderhold', 7, 12); wCloseTalk(); wDrain()")
        lava = await pg.evaluate("(() => { const m = MAPS.cinderhold; for (const y of [9, 15, 8, 16, 7, 17]) if (m.t[y][14] === 'L' && m.t[y][15] === 'L' && m.t[y][13] !== 'b' && m.t[y][16] !== 'b') return [14, y]; return null; })()")
        await click_tile(pg, *lava)
        r = await pg.evaluate("({ x: WG.x, y: WG.y, last: %s })" % LAST)
        check('lava' in r['last'].lower(), 'lava: you walk to the edge, or look from where you are', {'lava': lava, 'r': r})

        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm click passed')

if __name__ == "__main__": asyncio.run(main())
