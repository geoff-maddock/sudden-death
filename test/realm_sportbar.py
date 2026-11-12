# Realm sports screens (issue #80): the phone scoreboard over football, boxing and basketball, and the keys on the pad
# buttons. At 400px each of the three has a strip of text over its canvas with both sides, the score and where the game
# is, it follows the engine's state, and the page doesn't scroll sideways; at 1200px the strip is hidden (the canvas's
# own bar can be read). The ring's and the court's pad buttons carry their keys. Asserts; exits nonzero on failure.
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
STRIP = """id => { const e = document.getElementById(id); if (!e) return null; const cv = e.parentNode.querySelector('canvas');
  return { shown: getComputedStyle(e).display !== 'none', text: e.textContent, beforeCanvas: !!cv && !!(e.compareDocumentPosition(cv) & 4),
    font: parseFloat(getComputedStyle(e.querySelector('b') || e).fontSize), wide: document.documentElement.scrollWidth - innerWidth }; }"""

async def start(br, w, h):
    pg = await br.new_page(viewport={'width': w, 'height': h})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wSbRender === 'function'")
    await pg.evaluate("SET.tips = false; SET.sfx = false; SET.music = false")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
    await pg.evaluate("(() => { for (const kind of ['troll', 'harpy']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
    await pg.evaluate(CLOSE_ALL)
    return pg, errs

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg, errs = await start(br, 400, 800)

        # ---------- basketball ----------
        await pg.evaluate("wStartCourt({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'court' && wBK.live && !!document.getElementById('wSbCourt') && document.getElementById('wSbCourt').textContent.length > 0", timeout=30000)
        names = await pg.evaluate("wBK.G.teams.map(t => t.name)")
        s = await pg.evaluate(STRIP, 'wSbCourt')
        check(s['shown'] and s['beforeCanvas'] and all(n in s['text'] for n in names), 'on a phone the court has a scoreboard over the canvas with both clubs', s)
        check(s['font'] >= 13, 'its words are a size you can read', s['font'])
        check(s['wide'] <= 1, 'the court page does not scroll sideways on a phone', s['wide'])
        await pg.evaluate("wBK.pause(true); wBK.G.score = [37, 41]")
        await pg.wait_for_function("/37/.test(document.getElementById('wSbCourt').textContent) && /41/.test(document.getElementById('wSbCourt').textContent)", timeout=5000)
        check(True, 'the scoreboard follows the score')
        has = await pg.evaluate("[...document.querySelectorAll('#wSbCourt .wsbside')].map(e => e.classList.contains('has'))")
        check(has == await pg.evaluate("[wBK.G.poss === 0, wBK.G.poss === 1]"), 'and marks the side with the ball', has)
        await pg.evaluate("wBK.pause(false); wBK.setMode('play')")
        await pg.wait_for_function("!document.getElementById('wCourtPad').hidden && document.querySelectorAll('#wCourtPad [data-key]').length >= 4")
        keys = await pg.evaluate("[...document.querySelectorAll('#wCourtPad [data-cpad]')].map(b => b.dataset.key)")
        check(all(k and len(k) <= 8 for k in keys), "the court's pad buttons carry their keys", keys)
        await pg.evaluate("showView('world')")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- boxing ----------
        await pg.evaluate("W_RING_MODE = 'play'; wRingBout({ kinds: ['gorgon', 'ogre'], seed: 9 })")
        await pg.wait_for_function("UI.view === 'ring' && !!document.getElementById('wSbRing') && document.getElementById('wSbRing').textContent.length > 0", timeout=30000)
        names = await pg.evaluate("wBX.G.F.map(f => f.n)")
        s = await pg.evaluate(STRIP, 'wSbRing')
        check(s['shown'] and s['beforeCanvas'] and all(n in s['text'] for n in names) and 'Round 1' in s['text'] and 'Health' in s['text'] and 'Stamina' in s['text'], 'on a phone the ring has both fighters, the round, and health and stamina by name', s)
        check(s['wide'] <= 1, 'the ring page does not scroll sideways on a phone', s['wide'])
        await pg.evaluate("wBX.pause(true); wBX.G.F[1].hp = 25")
        await pg.wait_for_function("(() => { const b = document.querySelectorAll('#wSbRing .wsbside')[1].querySelector('.wsbbar > i'); return b && b.style.width === '25%'; })()", timeout=5000)
        check(True, "a fighter's health bar follows their health")
        keys = await pg.evaluate("[...document.querySelectorAll('#wRingPad [data-rpad]')].map(b => b.dataset.key)")
        check(keys == ['J', 'K', 'L', 'Space', 'Shift', 'E', 'Q', 'R'], "the ring's pad buttons carry their keys", keys)
        await pg.evaluate("wBX.pause(false); wLeaveRing()")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- football ----------
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call' && !!document.getElementById('wSbGrid') && document.getElementById('wSbGrid').textContent.length > 0", timeout=30000)
        names = await pg.evaluate("wGF.G.teams.map(t => t.name)")
        s = await pg.evaluate(STRIP, 'wSbGrid')
        check(s['shown'] and s['beforeCanvas'] and all(n in s['text'] for n in names) and '1st & 10' in s['text'] and '1st half' in s['text'], 'on a phone the gridiron has both clubs, the down and the clock', s)
        check(s['wide'] <= 1, 'the gridiron page does not scroll sideways on a phone', s['wide'])
        col = await pg.evaluate("(() => { const l = document.getElementById('wGridPowList'), m = document.getElementById('wGridMana'); return l && !l.closest('[hidden]') ? [l.getBoundingClientRect().width, l.getBoundingClientRect().top >= m.getBoundingClientRect().bottom - 1] : null; })()")
        check(col is None or (col[0] > 300 and col[1]), "football's power chips run across the page under Mana, not down a column beside it", col)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors on a phone', errs)
        await pg.close()

        # ---------- a wide window: the canvas's own bar does the job ----------
        pg, errs = await start(br, 1200, 900)
        await pg.evaluate("wStartCourt({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'court' && wBK.live", timeout=30000)
        await pg.evaluate("wSbRender()")
        s = await pg.evaluate(STRIP, 'wSbCourt')
        check(s is None or not s['shown'], 'on a wide window there is no second scoreboard', s)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors on a wide window', errs)
        await br.close()
    print('FAILED: ' + '; '.join(FAILS) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
