# Realm ways in and out: walking into any town puts you in the open (never inside a building), waking at any inn after
# a blackout puts you in front of the counter where you can walk out, somebody stuck behind a counter can climb over it,
# and the world has a menu (Menu button, Esc or P) whose Save and quit goes back to the title and resumes where you
# were. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-ways-*.png.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wOpenMenu === 'function'")
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg, clear=True)
            await new_journey(pg)
            if tag == 'desk':
                # ---------- every way into a town is out in the open ----------
                bad = await pg.evaluate("wAudit().filter(p => /inside a building|cut off/.test(p))")
                check(not bad, 'the audit finds no town you walk into inside a building, and no inn you wake cut off', bad)
                towns = await pg.evaluate("""(() => DB.locs.filter(L => L.map && MAPS[L.map] && MAPS[L.map].kind === 'town').map(L => {
                  wEnterMap('world', L.x, L.y + 1); WG.grace = 99; wStepEnter(wTileAt(MAPS.world, L.x, L.y), L.x, L.y);
                  const m = wCurMap(), c = wTileAt(m, WG.x, WG.y), seen = bfsReach(m, m.spawn[0], m.spawn[1]); let n = 0; for (const v of seen) n += v;
                  return { id: L.map, at: WG.map, tile: c, inside: wInsideBuilding(m, WG.x, WG.y), reach: n }; }))()""")
                check(len(towns) >= 5 and all(t['at'] == t['id'] and not t['inside'] and t['reach'] > 100 for t in towns), 'walking into each town puts you outside, with the town open to you', [t for t in towns if t['inside'] or t['at'] != t['id'] or t['reach'] <= 100])
                check(any(t['id'] == 'saltmere' for t in towns), 'Saltmere is among them (its way in used to be inside a building)')

                # ---------- every inn wakes you where you can walk out ----------
                wake = await pg.evaluate("""(() => ['graftonbury', 'mossgate', 'saltmere', 'cinderhold', 'rimewatch'].map(t => {
                  WG.home = t; RUN.gold = 100; RUN.pending = null; wBlackout({ kind: 'wild', ref: null }, 'lose'); document.getElementById('wWake') && document.getElementById('wWake').click();
                  const m = wCurMap(), seen = bfsReach(m, m.spawn[0], m.spawn[1]);
                  return { t, at: WG.map, ok: !!seen[WG.y * m.w + WG.x], inside: wInsideBuilding(m, WG.x, WG.y) }; }))()""")
                check(all(w['at'] == w['t'] and w['ok'] and w['inside'] for w in wake), 'after a blackout you wake inside each inn, in front of the counter, with a way out', wake)
                await pg.screenshot(path='/tmp/realm-ways-wake-desk.png')

                # ---------- behind a counter: climb over it ----------
                cl = await pg.evaluate("""(() => { const at = wInnSpot('graftonbury'); wEnterMap('graftonbury', at[0], at[1]); const m = wCurMap();
                  const inn = m.npcs.find(n => n.id === 'hq_inn'), seen = bfsReach(m, m.spawn[0], m.spawn[1]);
                  let spot = null, dir = null;
                  for (let y = inn.y - 1; y <= inn.y + 1 && !spot; y++) for (let x = inn.x - 3; x <= inn.x + 3 && !spot; x++) {
                    if (seen[y * m.w + x] || !walkCh(m.t[y][x]) || m.npcs.some(n => n.x === x && n.y === y)) continue;
                    for (const [dx, dy] of [[0, 1], [0, -1]]) if (m.t[y + dy] && m.t[y + dy][x] === '-') { spot = [x, y]; dir = [dx, dy]; break; } }
                  if (!spot) return { spot: null };
                  WG.x = spot[0]; WG.y = spot[1];
                  wTryMove(dir[0], dir[1]); const mid = m.t[WG.y][WG.x]; wTryMove(dir[0], dir[1]);
                  return { spot, mid, out: !!seen[WG.y * m.w + WG.x] }; })()""")
                check(cl.get('spot') and cl['mid'] == '-' and cl['out'], 'stuck behind a counter, you can climb over it and walk out', cl)
                front = await pg.evaluate("""(() => { const at = wInnSpot('graftonbury'); wEnterMap('graftonbury', at[0], at[1]); const m = wCurMap();
                  for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) if (wTileAt(m, WG.x + dx, WG.y + dy) === '-') { const x0 = WG.x, y0 = WG.y; wTryMove(dx, dy); return { moved: WG.x !== x0 || WG.y !== y0 }; }
                  return { moved: null }; })()""")
                check(front['moved'] is False, 'from the customer side, the counter still stops you', front)

            # ---------- the menu: save and quit, from anywhere in the world ----------
            await pg.evaluate("wDrain(); if (WUI.talk) wCloseTalk(); wEnterMap('world', 48, 40); WG.min = 12 * 60; WG.grace = 99; wDrain()")
            await pg.wait_for_selector('#wMenuBtn')
            await pg.screenshot(path=f'/tmp/realm-ways-hud-{tag}.png')
            if tag == 'phone':
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                check(not over, '[phone] the HUD with its Menu button fits the width')
            await pg.click('#wMenuBtn'); await pg.wait_for_selector('#pause:not([hidden]) #pSave')
            check(await pg.evaluate("document.getElementById('pSave').textContent") == 'Save and quit to title', f'[{tag}] the Menu button opens the menu, with Save and quit')
            await pg.click('#pResume'); await pg.wait_for_function("!UI.paused")
            await pg.keyboard.press('Escape'); await pg.wait_for_selector('#pause:not([hidden])')
            check(await pg.evaluate("UI.paused"), f'[{tag}] Esc opens the menu in the world')
            pos = await pg.evaluate("({ map: WG.map, x: WG.x, y: WG.y, gold: RUN.gold, day: WG.dayAbs })")
            await pg.click('#pSave'); await pg.wait_for_function("UI.screen === 'title'")
            st = await pg.evaluate("({ wg: !!WG, run: !!RUN, row: !!document.getElementById('bResume') })")
            check(not st['wg'] and not st['run'] and st['row'], f'[{tag}] Save and quit goes back to the title, with Continue there', st)
            await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
            back = await pg.evaluate("({ map: WG.map, x: WG.x, y: WG.y, gold: RUN.gold, day: WG.dayAbs })")
            check(back == pos, f'[{tag}] Continue picks up where you quit', {'before': pos, 'after': back})
            await pg.keyboard.press('p'); await pg.wait_for_selector('#pause:not([hidden])')
            check(await pg.evaluate("UI.paused"), f'[{tag}] P opens the menu too')
            await pg.click('#pResume'); await pg.wait_for_function("!UI.paused")

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm ways passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
