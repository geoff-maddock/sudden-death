# Realm baseball ratings (issue #4, phase 2): every founder starts with p.bd, seeded from their kind's player on
# Brimstone Diamond's founding clubs (the same position and hand, each stat within 1 of it); a recruit of every one of
# the 18 kinds gets ratings, the two pitching kinds with pitches; a player who joins at level N has had N-1 points;
# levelling up adds a point a level, never past 12; the ratings save; an older save without them gets them when it
# loads; each player's stats show a Baseball block (position, five bars, powers, pitches for a pitcher); How to play
# explains them; the block fits a phone. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-ratings-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

STATS = ['pow', 'con', 'spd', 'arm', 'fld']
POS9 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P']

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBdOf === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

def got(bd): return sum(bd['got'].values())

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await boot(pg); await new_journey(pg)

        # ---------- founders ----------
        f = await pg.evaluate("WG.roster.map(p => ({ kind: p.kind, lvl: p.lvl, bd: p.bd, t: wBD.templ(p.kind) }))")
        bad = [x['kind'] for x in f if not x['bd'] or x['bd']['pos'] not in POS9 or x['bd']['hand'] not in ('L', 'R') or x['bd']['lv'] != 1 or x['bd']['got'] != {}
               or any(abs(x['bd'][s] - x['t'][s]) > 1 or not 1 <= x['bd'][s] <= 10 for s in STATS)]
        check(len(f) == 3 and not bad, 'every founder has ratings within 1 of their kind\'s, at level 1', {'bad': bad, 'f': f})

        # ---------- every kind, joining at level 5 ----------
        kinds = await pg.evaluate("""(() => Object.keys(KIND_NAME).map(kind => { const p = wMakePlayer({ kind, lvl: 5 }, 'tavern');
          return { kind, bd: p.bd, ab: ['bat', 'run', 'field', 'ult'].map(k => p.bd[k]).filter(Boolean).every(id => { const N = wBdNames(); return N.ab[id] || N.ult[id]; }) }; }))()""")
        STARS = await pg.evaluate("W_STARS.filter(s => s.kind).length")  # superstars built so far (issue #24): each is a kind of its own
        check(len(kinds) == 18 + STARS and all(k['bd'] for k in kinds), 'a recruit of each of the 18 kinds, and each superstar, gets ratings', [k['kind'] for k in kinds if not k['bd']])
        check(all(k['bd']['lv'] == 5 and got(k['bd']) == 4 for k in kinds), 'joining at level 5 means 4 points from levels', [(k['kind'], k['bd']['got']) for k in kinds if got(k['bd']) != 4])
        pit = sorted(k['kind'] for k in kinds if k['bd']['pos'] == 'P')
        check(pit == ['kobold', 'witch'] and all((k['bd']['pitches'] or []) for k in kinds if k['bd']['pos'] == 'P') and not any(k['bd']['pitches'] for k in kinds if k['bd']['pos'] != 'P'),
              'the two pitching kinds have pitches, nobody else does', pit)
        check(all(k['ab'] for k in kinds), 'every power and ultimate has a name to show', [k['kind'] for k in kinds if not k['ab']])

        # ---------- levelling up ----------
        lv = await pg.evaluate("""(() => { const p = WG.roster[0], before = JSON.parse(JSON.stringify(p.bd)); wGiveXp(p, 2000);
          return { lvl: p.lvl, bd: p.bd, sum: ['pow','con','spd','arm','fld'].reduce((a, s) => a + p.bd[s], 0), sum0: ['pow','con','spd','arm','fld'].reduce((a, s) => a + before[s], 0) }; })()""")
        check(lv['lvl'] > 1 and lv['bd']['lv'] == lv['lvl'] and got(lv['bd']) == lv['lvl'] - 1 and lv['sum'] - lv['sum0'] == lv['lvl'] - 1,
              'each level-up adds one point', lv)
        cap = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'ogre', lvl: 1 }, 'tavern'); for (const s of ['pow','con','spd','arm']) p.bd[s] = 12; p.bd.fld = 3;
          p.lvl = 6; wBdOf(p); return p.bd; })()""")
        check(all(cap[s] == 12 for s in ['pow', 'con', 'spd', 'arm']) and cap['fld'] == 8, 'no stat goes past 12: the points go where there is room', cap)

        # ---------- saving, and an older save ----------
        await pg.evaluate("wSave()")
        saved = await pg.evaluate("JSON.parse(localStorage.getItem(wSaveKey())).WG.roster.map(p => p.bd)")
        check(all(b and b['pos'] in POS9 for b in saved), 'the ratings are in the save', saved)
        await pg.evaluate("""(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())); for (const p of s.WG.roster) delete p.bd; s.WG.roster[1].lvl = 4;
          localStorage.setItem(wSaveKey(), JSON.stringify(s)); })()""")
        await pg.reload(); await pg.wait_for_function("typeof wBdOf === 'function'")
        await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
        old = await pg.evaluate("WG.roster.map(p => ({ lvl: p.lvl, bd: p.bd }))")
        check(all(o['bd'] and o['bd']['lv'] == o['lvl'] and got(o['bd']) == o['lvl'] - 1 for o in old), 'an older save gets ratings, with its levels\' points, when it loads', old)
        check(await pg.evaluate("JSON.parse(localStorage.getItem(wSaveKey())).WG.roster.every(p => !!p.bd)"), 'and saves them')

        # ---------- the Stats page ----------
        await pg.evaluate("WG.roster.push(Object.assign(wMakePlayer({ kind: 'witch', lvl: 3 }, 'tavern'), { id: WG.pid++ })); wOpenStats(WG.roster[0].id)")
        await pg.wait_for_selector('#modalBox .wbd')
        card = await pg.evaluate("""(() => { const c = document.querySelector('#modalBox .wbd'); return { bars: c.querySelectorAll('.wbdr').length, pos: c.querySelector('.wbdpos').textContent,
          plus: [...c.querySelectorAll('.wbdr small')].map(s => s.textContent).join(''), pw: c.querySelectorAll('.wbdpw li').length }; })()""")
        check(card['bars'] == 5 and card['pos'].startswith('Plays ') and '+' in card['plus'] and card['pw'] >= 1, 'a player\'s stats show a Baseball block: position, five bars, points from levels, powers', card)
        await pg.screenshot(path='/tmp/realm-ratings-stats-desk.png')
        await pg.evaluate("wOpenStats(WG.roster[WG.roster.length - 1].id)"); await pg.wait_for_timeout(200)
        wp = await pg.evaluate("(document.querySelector('#modalBox .wbdpit') || {}).textContent || ''")
        check(wp.startswith('Pitches:') and 'Frost Orb' in wp, 'a pitcher\'s block lists their pitches', wp)

        # ---------- How to play, and a phone ----------
        await pg.evaluate("document.getElementById('modal').hidden = true; showPage('help')")
        h = await pg.evaluate("(() => { const a = document.getElementById('wHelpStats'), b = document.getElementById('wHelpBaseball'); return !!b && a.nextElementSibling === b && /ratings/.test(b.textContent); })()")
        check(h, 'How to play explains the ratings, after the stats')
        await pg.evaluate("showPage('play')")
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(200)
        await pg.evaluate("wOpenStats(WG.roster[0].id)"); await pg.wait_for_selector('#modalBox .wbd')
        fit = await pg.evaluate("(() => { const c = document.querySelector('#modalBox .wbd'), r = c.getBoundingClientRect(); return { right: r.right, vw: innerWidth, sw: c.scrollWidth, cw: c.clientWidth }; })()")
        check(fit['right'] <= fit['vw'] and fit['sw'] <= fit['cw'] + 1, 'the Baseball block fits a phone', fit)
        await pg.evaluate("document.querySelector('#modalBox .wbd').scrollIntoView()")
        await pg.screenshot(path='/tmp/realm-ratings-stats-phone.png')

        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond ratings passed')

asyncio.run(main())
