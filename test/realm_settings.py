# The Settings button opens the settings panel, in both builds. In the Realm, boot() runs after app/settings.js has
# wired the button, so boot must not take it back (it used to put the old sound toggle on it, and Settings did
# nothing you could see). Asserts, and exits nonzero on a failure.
import asyncio, json, sys, subprocess
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import GAME_URL, REALM_URL, REALM_BUILD, GAME_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)))
    if not ok: FAILS.append(what)
    return ok

async def one(b, name, url):
    pg = await b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url)
    await pg.evaluate('localStorage.clear()')
    await pg.reload()
    await pg.wait_for_selector('#bSound', state='visible')
    before = await pg.evaluate('SND.on')
    await pg.click('#bSound')
    try:
        await pg.wait_for_selector('#modal:not([hidden]) #sMusic', timeout=3000)
        opened = True
    except Exception:
        opened = False
    check(opened, f'{name}: Settings opens the settings panel')
    check(await pg.evaluate('SND.on') == before, f'{name}: Settings does not toggle sound on its own')
    if opened:
        await pg.click('#modal:not([hidden]) #sSfx')
        check(await pg.evaluate('SET.sfx') is False, f'{name}: the sound effects toggle switches off')
        check(await pg.evaluate("JSON.parse(localStorage.getItem('sd-settings')).sfx") is False, f'{name}: the setting is saved')
    check(not errs, f'{name}: no page errors', errs)
    await pg.close()

async def main():
    subprocess.run(GAME_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await one(b, 'Sudden Death', GAME_URL)
        await one(b, 'Realm', REALM_URL)
        await b.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
