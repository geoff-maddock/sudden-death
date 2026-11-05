# Realm ring on the Team screen (issue #23, follow-up). The Ring tab: every player of yours with their boxing ratings,
# their nature when their kind has one, and their record; Box a card opens the card at the Anvil Ring, the Anvil Belt
# button opens the Belt, and with a card waiting the button resumes it; the last cards. The Stats tab's Boxing view:
# every boxer's line, sortable. A player's stats card: a Boxing block with the six ratings (and what levels added), the
# nature, and the line in words. How to play explains it; the tabs and the Ring tab fit a phone. Asserts; exits nonzero.
# Screenshots: /tmp/realm-ring-tab-*.png.
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

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #wRingOk, #wEvWalk, #wEvDone, #wBxLater'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        # a spider on the team (a kind with a nature), and a card's lines for the first two
        await pg.evaluate("""(() => { wAddPlayer(wMakePlayer({ kind: 'spider', lvl: 4 }, 'tavern')); const R = wRoster();
          WG.bxstats = { [R[0].id]: { bb: 3, w: 2, l: 1, d: 0, ko: 1, kd: 2, down: 1, landed: 60, thrown: 140, pw: 4 }, [R[1].id]: { bb: 1, w: 0, l: 1, d: 0, ko: 0, kd: 0, down: 2, landed: 15, thrown: 50, pw: 1 } };
          WG.bxg = { live: null, met: {}, opp: {}, cards: [{ day: 1, club: 'local', name: 'The Pickups', tier: 1, how: 'sim', r: 'win', us: 2, them: 1, by: 'bouts', kos: 0 }], w: 1, l: 0, t: 0 }; })()""")

        # ---------- the Ring tab ----------
        await pg.evaluate("wOpenCamp('ring')"); await pg.wait_for_selector('#modalBox .wring')
        t = await pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#modalBox .wring > li')], R = wRoster();
          const spider = R.find(p => p.kind === 'spider'), srow = document.querySelector(`#modalBox [data-rpid="${spider.id}"]`);
          return { tab: !!document.querySelector('#modalBox [data-ctab="ring"][aria-selected="true"]'), rows: rows.length, n: R.length,
            ratings: rows.every(r => (r.querySelector('.wnst').textContent.match(/\\b\\d+\\b/g) || []).length === 6), trait: srow && srow.textContent.includes('Long Arms'),
            rec: rows[0].textContent.includes('3 bouts: 2–1') && rows[0].textContent.includes('1 KO'), none: srow && srow.textContent.includes('No bouts yet'),
            play: !!document.querySelector('[data-rgplay]'), belt: !!document.querySelector('[data-rgbelt]'), last: /Last cards: 1/.test(document.getElementById('modalBox').textContent) }; })()""")
        check(t['tab'] and t['rows'] == t['n'] and t['ratings'], 'the Ring tab lists every player of yours with their six boxing ratings', t)
        check(t['trait'] and t['rec'] and t['none'], 'with their nature (a spider\'s Long Arms) and their record (none yet for a new one)', t)
        check(t['play'] and t['belt'] and t['last'], 'Box a card, the Anvil Belt, and the last cards', t)
        await pg.screenshot(path='/tmp/realm-ring-tab.png')
        await pg.click('[data-rgplay]')
        o = await pg.evaluate("({ card: !!document.getElementById('wBxExhib'), rows: document.querySelectorAll('#modalBox .wbclubs > li').length })")
        check(o['card'] and o['rows'] >= 1, 'Box a card opens the card at the Anvil Ring', o)
        await pg.evaluate(CLOSE)
        await pg.evaluate("wOpenCamp('ring')"); await pg.wait_for_selector('[data-rgbelt]'); await pg.click('[data-rgbelt]')
        check(await pg.evaluate("!!document.querySelector('#modalBox #wBcupEnter, #modalBox .wdcb')"), 'the Anvil Belt button opens the Belt')
        await pg.evaluate(CLOSE)
        rz = await pg.evaluate("(() => { WG.bxg.live = { world: { kind: 'bxcard', club: 'local', tier: 1, how: 'manage', day: WG.dayAbs, name: 'X', ids: [], cup: false }, snap: null }; wOpenCamp('ring'); const r = { resume: !!document.querySelector('[data-rgresume]'), play: !!document.querySelector('[data-rgplay]') }; WG.bxg.live = null; return r; })()")
        check(rz == {'resume': True, 'play': False}, 'with a card waiting, the button resumes it', rz)
        await pg.evaluate(CLOSE)

        # ---------- the Stats tab's Boxing view ----------
        await pg.evaluate("wOpenCamp('stats')"); await pg.wait_for_selector('#modalBox [data-wsview="boxing"]')
        await pg.click('#modalBox [data-wsview="boxing"]')
        sv = await pg.evaluate("""(() => { const heads = [...document.querySelectorAll('#modalBox .wstats thead th')].map(h => h.textContent.trim()), R = wRoster();
          const cell = (pid, i) => document.querySelector(`#modalBox tr[data-wsp="${pid}"]`).children[i].textContent.trim();
          return { heads, first: [cell(R[0].id, 1), cell(R[0].id, 2), cell(R[0].id, 5)], dash: cell(R[R.length - 1].id, 1) === '–', hint: document.querySelector('#modalBox small.hint').textContent }; })()""")
        check(sv['heads'][1:] == ['B', 'W', 'L', 'D', 'KO', 'KD', 'Down', 'Landed', 'Thrown', 'Pw'] and sv['first'] == ['3', '2', '1'] and sv['dash'] and 'bout' in sv['hint'],
              'the Stats tab has a Boxing view: every boxer\'s line (a dash for none)', sv)
        await pg.click('#modalBox [data-wsort="down"]')
        srt = await pg.evaluate("(() => { const R = wRoster(); return document.querySelector('#modalBox .wstats tbody tr').dataset.wsp == R[1].id; })()")
        check(srt, 'sorted by a heading (knockdowns taken)', srt)
        await pg.screenshot(path='/tmp/realm-ring-tab-stats.png')
        # a player's stats card
        await pg.evaluate("(() => { const s = wRoster().find(p => p.kind === 'spider'); WSTAT.pid = s.id; wRenderCamp(); })()")
        cd = await pg.evaluate("(() => { const b = document.querySelector('#modalBox .wbxc'); return b ? { bars: b.querySelectorAll('.wbdr').length, text: b.textContent } : null; })()")
        check(cd and cd['bars'] == 6 and 'Long Arms' in cd['text'] and 'Ratings run from 1 to 12' in cd['text'], 'a player\'s stats card has a Boxing block: six ratings, their nature', cd)
        await pg.evaluate("(() => { WSTAT.pid = wRoster()[0].id; wRenderCamp(); })()")
        ln = await pg.evaluate("(document.querySelector('#modalBox .wbxc .wbdbox') || {}).textContent || ''")
        check('3 bouts: 2 won, 1 lost' in ln and '1 inside the distance' in ln and '60 of 140 punches landed' in ln, 'and their line in words', ln)
        await pg.evaluate("WSTAT.view = 'journey'; WSTAT.sort = null; WSTAT.pid = null")
        await pg.evaluate(CLOSE)

        # ---------- How to play, a phone ----------
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpRingTab'); return e ? e.textContent : ''; })()")
        check('Ring tab' in h and 'Boxing view' in h, 'How to play explains the Ring tab and the Boxing view', h)
        await pg.set_viewport_size({'width': 360, 'height': 800})
        await pg.evaluate("wOpenCamp('ring')"); await pg.wait_for_selector('#modalBox .wring')
        ph = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return { sw: b.scrollWidth, cw: b.clientWidth, doc: document.documentElement.scrollWidth <= window.innerWidth + 1 }; })()")
        await pg.screenshot(path='/tmp/realm-ring-tab-phone.png')
        check(ph['sw'] <= ph['cw'] + 1 and ph['doc'], 'the Ring tab fits a phone', ph)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
