# Realm sport pages (issue #80). Football and basketball are laid out alike: the bar (title, Watch / Manage / You play,
# leaving) with the status line under it, the picture, the coach's rows (a label, then its buttons: the call, the
# stance, Powers, Subs, Bag), the two sides' tables side by side, then This game. Football's calls work from their new
# place under the field; basketball's log follows the scoring. Asserts; exits nonzero on failure.
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
# a page's pieces: the mode names, the status line, the rows' labels in order, and where things sit
PAGE = """((bar, note, modes, view, coach, tables) => { const top = e => Math.round(e.getBoundingClientRect().top), vis = e => !!e && e.offsetParent !== null;
  const cv = document.querySelector(view + ' canvas'), T = [...document.querySelectorAll(tables)].filter(vis), C = document.querySelector(coach);
  return { modes: [...document.querySelectorAll(modes + ' button')].map(b => b.textContent), on: [...document.querySelectorAll(modes + ' button.on')].length,
    noteIn: !!document.querySelector(bar + ' ' + note + '.wsnote'), noteText: document.querySelector(note).textContent.length > 10, noteUnder: top(document.querySelector(note)) > top(document.querySelector(modes)),
    labels: [...C.querySelectorAll('.wccrow')].filter(vis).map(r => r.querySelector('.wccl').textContent).filter(Boolean),
    coachUnder: top(C) >= Math.round(cv.getBoundingClientRect().bottom) - 1, tablesUnder: T.length === 2 && top(T[0]) > top(C), sideBySide: T.length === 2 && Math.abs(top(T[0]) - top(T[1])) < 4 && T[1].getBoundingClientRect().left > T[0].getBoundingClientRect().right - 2,
    scroll: document.documentElement.scrollWidth - innerWidth }; })"""
GRID = PAGE + "('#wGridBar', '#wGridNote', '#wGridModes', '#v-gridiron', '#wGridCoach', '#wGridLineup table')"
COURT = PAGE + "('#wCourtBar', '#wCourtNote', '#wCourtModes', '#v-court', '#wCourtCalls', '#wCourtBox table')"

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStartCourt === 'function'")
        await pg.evaluate("SET.tips = false; SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { for (const kind of ['troll', 'harpy']) wRecruit({ kind, lvl: 2 }, 'tavern'); })()")
        await pg.evaluate(CLOSE_ALL)

        # ---------- football ----------
        await pg.evaluate("wStartGrid({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'gridiron' && wGF.phase === 'call'", timeout=30000)
        g = await pg.evaluate(GRID)
        check(g['modes'] == ['Watch', 'Manage', 'You play'] and g['on'] == 1, 'football: Watch, Manage, You play on the bar, one lit', g)
        check(g['noteIn'] and g['noteText'] and g['noteUnder'], 'football: the status line is under the bar\'s buttons', g)
        check(g['labels'] == ['Play', 'Stance', 'Powers', 'Subs', 'Bag'] and g['coachUnder'], 'football: the coach\'s rows are under the field: Play, Stance, Powers, Subs, Bag', g)
        check(g['tablesUnder'] and g['sideBySide'], 'football: the two lineups sit side by side under the rows', g)
        check(not await pg.evaluate("!!document.querySelector('#wGridBar [data-gcall], #wGridBar [data-gstance], #wGridBar [data-gpow]')"), 'football: the bar has no calls left on it')
        # a call from its new place is heard
        n0 = await pg.evaluate("wGF.G.plays ? wGF.G.plays.length : -1")
        await pg.click('#wGridRowCall [data-gcall]:not([disabled])')
        await pg.wait_for_function("wGF.phase !== 'call'", timeout=10000)
        check(True, 'football: a play called from the row under the field is run', n0)
        # their ball: the row is Defense
        await pg.evaluate("wGF.speed = 8")
        try:
            await pg.wait_for_function("wGF.phase === 'call' && !wGF.yourBall || !wGF.live", timeout=5000)
        except Exception: pass
        for _ in range(60):
            st = await pg.evaluate("({ ph: wGF.phase, mine: wGF.yourBall, live: wGF.live })")
            if not st['live'] or (st['ph'] == 'call' and not st['mine']): break
            if st['ph'] == 'call': await pg.evaluate("(() => { const b = document.querySelector('#wGridRowCall [data-gkick=\"punt\"]:not([disabled]), #wGridRowCall [data-gcall]:not([disabled])'); if (b) b.click(); })()")
            await pg.wait_for_function(f"wGF.phase !== '{st['ph']}' || !wGF.live || (wGF.phase === 'call' && wGF.yourBall !== {json.dumps(st['mine'])})", timeout=60000)
        d = await pg.evaluate("({ lab: document.getElementById('wGridCallL').textContent, defs: !document.getElementById('wGridDefs').hidden, ph: wGF.phase, mine: wGF.yourBall })")
        check(d['lab'] == 'Defense' and d['defs'], 'football: when they have the ball the row is Defense', d)
        await pg.click('#wGridRowCall [data-gdef]:not([disabled])'); await pg.wait_for_function("wGF.phase !== 'call'", timeout=10000)
        check(True, 'football: a defense called from the row is run')
        # Watch: the rows go, a line says why
        await pg.click('#wGridModes [data-gmode="watch"]')
        w = await pg.evaluate("({ rows: ['wGridRowCall', 'wGridRowStance', 'wGridRowPow'].map(i => document.getElementById(i).hidden), none: !document.getElementById('wGridCoachNone').hidden })")
        check(all(w['rows']) and w['none'], 'football: under Watch the call rows go and a line says the coaches call it', w)
        await pg.set_viewport_size({'width': 400, 'height': 800})
        gp = await pg.evaluate(GRID)
        check(gp['scroll'] <= 0, 'football: nothing scrolls sideways on a phone', gp)
        await pg.set_viewport_size({'width': 1200, 'height': 900})
        await pg.evaluate("wLeaveGridiron()"); await pg.wait_for_function("UI.view === 'world'"); await pg.evaluate(CLOSE_ALL)

        # ---------- basketball ----------
        await pg.evaluate("wStartCourt({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'court' && wBK.live && !!document.querySelector('#wCourtCalls .wccrow')", timeout=30000)
        c = await pg.evaluate(COURT)
        check(c['modes'] == g['modes'] and c['on'] == 1, 'basketball: the same three on the bar', c)
        check(c['noteIn'] and c['noteText'] and c['noteUnder'], 'basketball: the status line is under the bar\'s buttons', c)
        check(c['coachUnder'] and all(k in c['labels'] for k in ['Offense', 'Defense', 'Powers', 'Subs', 'Bag']), 'basketball: the coach\'s rows are under the court, with Powers, Subs and Bag as in football', c)
        check(c['tablesUnder'] and c['sideBySide'], 'basketball: the two box scores sit side by side under the rows', c)
        e = await pg.evaluate("document.getElementById('wCourtLog').textContent")
        check('No baskets yet' in e, 'basketball: This game starts empty', e)
        await pg.evaluate("wBK.speed = 8; wBK.setMode('watch')")
        await pg.wait_for_function("wBK.G.log.length >= 3 && document.querySelectorAll('#wCourtLog li').length >= 3", timeout=120000)
        L = await pg.evaluate("""(() => { const G = wBK.G, n = document.querySelectorAll('#wCourtLog li').length, e = G.log.slice(0, n), sc = [0, 0]; for (const x of e) sc[x.side] += x.pts;
          const li = [...document.querySelectorAll('#wCourtLog li')]; return { n, last: li[n - 1].textContent, want: sc.join('–'), who: e[n - 1].who, first: li[0].textContent }; })()""")
        check(L['want'] in L['last'] and L['who'] in L['last'], 'basketball: This game lists each score with who made it and the score after it', L)
        await pg.set_viewport_size({'width': 400, 'height': 800})
        cp = await pg.evaluate(COURT)
        check(cp['scroll'] <= 0, 'basketball: nothing scrolls sideways on a phone', cp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('FAILS:', len(FAILS)); sys.exit(1 if FAILS else 0)

asyncio.run(main())
