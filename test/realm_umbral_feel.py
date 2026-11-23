# Realm: the Umbral's feel (issue #99, phase 8). Sounds (counted, not played): crossing the portal hums (rising coming
# home), resting by a lantern chimes, a piece won rings bells, the Seal forged plays a chord. The dark world has its own
# lines as you walk it. A dark ground's field is drawn darker than its light twin. Asserts; exits nonzero on failure.
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
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbSound === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; window.__snd = []; wUmbSound = k => __snd.push(k); 0")

        s = await pg.evaluate("""(() => { const out = {}, [x, y] = W_UMB.portal.umbralden;
          wEnterMap('umbralden', 2, 6); let [bx, by] = wUmbBeside(MAPS.umbralden, x, y); WG.x = bx; WG.y = by; __snd.length = 0; wTryMove(x - bx, y - by); wDrain(); out.cross = __snd.slice();
          [bx, by] = wUmbBeside(MAPS['u:umbralden'], x, y); WG.x = bx; WG.y = by; __snd.length = 0; wTryMove(x - bx, y - by); wDrain(); out.home = __snd.slice();
          const w = MAPS['u:world'], k = Object.keys(w.meta).find(k => w.meta[k].lantern).split(',').map(Number); wEnterMap('u:world', k[0], k[1] + 1); __snd.length = 0; wUmbLantern(k[0], k[1]); document.getElementById('wUmbRest').click(); out.rest = __snd.slice();
          __snd.length = 0; W_ON_END.nadir('win', { id: 'gate' }); out.piece = __snd.slice(); WG.cardOffer = null;
          for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          WG.umbral.pieces = Object.keys(W_UMB_PIECES); __snd.length = 0; wUmbSeal(); out.seal = __snd.slice();
          return out; })()""")
        check(s['cross'] == ['cross'] and s['home'] == ['home'], 'crossing the portal hums, and coming home rises', s)
        check(s['rest'] == ['rest'] and s['piece'] == ['piece'] and 'seal' in s['seal'], 'a lantern rest chimes, a piece rings bells, the Seal plays its chord', s)

        a = await pg.evaluate("""(() => { WG.umbral.sealed = 0; const L = DB.locs.find(l => l.id === 'rimewatch'); wEnterMap('u:world', L.x, L.y + 3);
          const n0 = WLOG.length, rnd = Math.random; Math.random = () => 0; WG.step = W_UMB7.every; wAmbient(MAPS['u:world'], regionAt(WG.x, WG.y)); Math.random = rnd;
          return WLOG.slice(n0).map(l => l[0]); })()""")
        check(len(a) == 1 and a[0] in await pg.evaluate("W_UMB7.world"), 'the dark world says a line of its own as you walk it', a)

        dm = await pg.evaluate("""(() => { const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; const c = cv.getContext('2d');
          const lum = (m) => { c.clearRect(0, 0, 32, 32); const F = m.field; WGND.d(c, WINK.plains, () => .5, { m, x: F.x + 2, y: F.y + 2, at: () => 'd' }); const d = c.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4); };
          return { light: lum(MAPS.g_bowl), dark: lum(MAPS['u:g_bowl']) }; })()""")
        check(dm['dark'] < dm['light'] * .75, "a dark ground's field is drawn darker than its light twin", dm)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
