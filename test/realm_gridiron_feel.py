# Realm gridiron feel (issue #9, phase 9). The coach's notes: Football once your team has five players, the Cinder
# Cup once you have won a football game. Sound on the gridiron: the whistle, the hits and the crowd through a game,
# and nothing with Sound effects off. Medals: a football game won and a Cinder Cup won count, and both are in the book.
# How to play. Asserts; exits nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wGridOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
# count the sounds instead of playing them
SPY = "(() => { window.__snd = {}; for (const k of Object.keys(sfx)) sfx[k] = () => { __snd[k] = (__snd[k] || 0) + 1; }; })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wGridTips === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS).filter(k => k !== 'w_grid' && k !== 'w_gcup')); SET.tips = true")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the coach's notes ----------
        await pg.wait_for_timeout(1000)
        check(not await pg.evaluate("TIPS_SEEN.includes('w_grid') || tipQ.includes('w_grid')"), 'no Football note with three players')
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_grid') || TIPS_SEEN.includes('w_grid')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Football' in coach and 'Seven tab' in coach, "with five players, a coach's note says how to play football", coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')

        # ---------- sound on the gridiron ----------
        await pg.evaluate("SET.sfx = true; SND.on = true")
        await pg.evaluate(SPY)
        await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        await pg.evaluate("wGF.setMode('watch')")
        await pg.wait_for_function("(window.__snd.hit || 0) + (window.__snd.crunch || 0) + (window.__snd.block || 0) + (window.__snd.crowd || 0) >= 3", timeout=60000)
        s = await pg.evaluate("__snd")
        check(s.get('whistle', 0) >= 1, 'the whistle at the kickoff', s)
        check(sum(s.get(k, 0) for k in ('hit', 'crunch', 'block', 'crowd', 'bad', 'horn')) >= 3, 'the plays make their sounds', s)
        await pg.evaluate("SET.sfx = false; window.__snd = {}")
        await pg.wait_for_timeout(4000)
        check(await pg.evaluate("Object.keys(__snd).length") == 0, 'with Sound effects off, the gridiron is quiet', await pg.evaluate("__snd"))
        await pg.evaluate("SET.sfx = true")

        # ---------- medals: a game won ----------
        w0 = await pg.evaluate("ACHS.stats.realmGridWins || 0")
        await pg.evaluate("(() => { const G = wGF.G; G.half = 2; G.clock = 1; G.score = [28, 0]; })()")
        await pg.wait_for_function("wGF.phase === 'over' && !WG.gfg.live", timeout=60000)
        s = await pg.evaluate("__snd")
        check(s.get('horn', 0) >= 1, 'a win ends with the horn', s)
        check(await pg.evaluate("WG.gfg.games[0].r") == 'win' and await pg.evaluate("ACHS.stats.realmGridWins || 0") == w0 + 1, 'a won football game counts for the Gridiron Grit medal')
        await pg.click('#wGridBack'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_gcup') || TIPS_SEEN.includes('w_gcup')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Cinder Cup' in coach and 'CINDER' in coach, 'after a win, a coach\'s note points to the Cinder Cup', coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')

        # ---------- medals: a cup won ----------
        d0 = await pg.evaluate("ACHS.stats.realmGcups || 0")
        await pg.evaluate("(() => { RUN.gold = 500; wGcupEnter(); WG.gcup.round = 2; WG.gcup.games = [[{ a: 'me', b: WG.gcup.field[1], ra: 7, rb: 0, w: 'me' }], [{ a: 'me', b: WG.gcup.field[2], ra: 7, rb: 0, w: 'me' }], [{ a: 'me', b: WG.gcup.field[4], ra: 14, rb: 7, w: 'me' }]]; wGcupWon(); })()")
        check(await pg.evaluate("ACHS.stats.realmGcups || 0") == d0 + 1 and await pg.evaluate("ACH.some(a => a.id === 'w_gcup') && ACH.some(a => a.id === 'w_grid')"), 'a won Cinder Cup counts for its medal; both medals are in the book')
        await pg.evaluate(CLOSE_ALL)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGfFeel'); return h ? h.textContent : ''; })()")
        check('Sound effects' in help_ and 'medals' in help_, 'How to play mentions the sound and the medals', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
