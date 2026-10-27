# Realm Diamond Cup (issue #4, phase 5): the League clerk's DIAMOND topic opens the cup. Entry costs the fee and
# draws a field of eight: you first, rival clubs and regional nines, all different. Your quarter-final (Simulate)
# settles, and back in the world the rest of the round is played out on the engine, with scores, and the bracket
# shows; the semi-final is played on the diamond (Play) and the round catches up when you're back; winning the final
# pays the prize (gold, fans, a pick of baseball cards), counts the win, writes it in the journal and on the Wall of
# Awards. The cup is once a week. Losing knocks you out, and the rest of the bracket is played to a champion. The cup
# is in the save. How to play explains it, and the bracket fits a phone. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-dcup-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wBallOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
# close whatever comes up (a level-up card pick, a recruit) until the bracket shows
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 20 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.dcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenDcup === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await new_journey(pg)

        # the clerk's topic, and the squad rule
        await pg.evaluate("(() => { const r = wSay('clerk', 'diamond'); wRunAct(r.act, 'clerk'); })()"); await pg.wait_for_selector('#modalBox #wDcupEnter')
        off = await pg.evaluate("({ off: document.getElementById('wDcupEnter').disabled, why: (document.querySelector('#modalBox .wbad') || {}).textContent || '' })")
        check(off['off'] and 'Recruit 2 more' in off['why'], 'the clerk opens the Diamond Cup; three founders cannot enter', off)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wRecruit({ kind: 'troll', lvl: 2 }, 'tavern'); wRecruit({ kind: 'harpy', lvl: 2 }, 'tavern'); RUN.gold = 500")
        await pg.evaluate(CLOSE_ALL)

        # entry
        await pg.evaluate("wOpenDcup()"); await pg.wait_for_selector('#modalBox #wDcupEnter:not([disabled])')
        await pg.click('#wDcupEnter'); await pg.wait_for_selector('#modalBox [data-dchow]')
        D = await pg.evaluate(CUP)
        f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f) and any(not x.startswith('wild:') and x != 'me' for x in f),
              'entry: a field of eight, you first, rivals and regional nines', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')
        await pg.screenshot(path='/tmp/realm-dcup-entry.png')

        # quarter-final: simulate, forced to a win
        await pg.evaluate("W_DCUP.force = 'win'")
        await pg.click('#modalBox [data-dchow="sim"]')
        await pg.wait_for_selector('#wBallOk'); await pg.click('#wBallOk')
        await pg.wait_for_selector('#modalBox .wdcb')
        D = await pg.evaluate(CUP)
        qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['ra'] != g['rb'] and g['w'] in (g['a'], g['b']) for g in qf),
              'the quarter-final: yours settles, the rest are played out with scores', qf)
        check(qf[0]['w'] == 'me', 'you go through', qf[0])
        await pg.screenshot(path='/tmp/realm-dcup-bracket.png')

        # semi-final: played on the diamond
        await pg.evaluate("W_DCUP.force = 'win'")
        await pg.click('#modalBox [data-dchow="play"]')
        await pg.wait_for_function("UI.view === 'diamond' && WG.ball.live && WG.ball.live.world.kind === 'dcup' && wBD.G.phase === 'plate'", timeout=15000)
        tier = await pg.evaluate("WG.ball.live.world.tier")
        check(tier == 2, 'the semi-final is tier 2 (Knight)', tier)
        await pg.evaluate("wBD.G.teams.forEach(t => t.ctl = 'cpu'); wBD.simToEnd(true)")
        await pg.wait_for_function("!WG.ball.live && !document.getElementById('wDiamondBack').hidden")
        await pg.click('#wDiamondBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'back in the world, the semi-finals are in: on to the final', D['games'][1])

        # the save keeps the cup
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.dcup && s.WG.dcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const wTOffer = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return wTOffer.apply(this, arguments); }; })()")
        await pg.evaluate("W_DCUP.force = 'win'")
        await pg.click('#modalBox [data-dchow="sim"]')
        await pg.wait_for_selector('#wBallOk'); await pg.click('#wBallOk')
        offer = await pg.evaluate("!!WG.cardOffer || !!document.querySelector('#modalBox .card')")
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.dcup.done")
        stuck = await pg.evaluate("!!WG.cardOffer && document.getElementById('modal').hidden")
        check(not stuck, 'no card pick is left waiting behind a closed panel')
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.dcupWins, journal: wJ().wins.map(w => w.t), offers: WLOG.filter(l => /Diamond Cup prize/.test(l[0])).length })")
        g1 = await pg.evaluate("RUN.gold")
        check(D['champ'] == 'me' and won['wins'] == 1, 'win the final: the Diamond Cup is yours', D)
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, baseball: (o.pool || []).every(id => CARDS[id].sport === 'baseball') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['baseball'] for o in offers), 'the prize includes a pick of 3 baseball cards', offers)
        check(g1 - g0 >= 150 and won['wins'] == 1, 'the prize: gold', {'gold': [g0, g1], 'won': won})
        check('Won the Diamond Cup' in won['journal'], 'it goes in the journal', won['journal'])
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('Diamond Cup' in wall, 'and on the Wall of Awards', wall)

        # once a week
        r = await pg.evaluate("wDcupEnter()")
        check('once a week' in r, 'the next cup is next week', r)

        # a new week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.ball.met = {}")
        await pg.evaluate("wDcupEnter(); W_DCUP.force = 'lose'; wDcupPlay('sim')")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.dcup.done", timeout=20000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpDcup'); return h ? h.textContent : ''; })()")
        check('Diamond Cup' in help_ and 'once yours is done' in help_, 'How to play explains the Diamond Cup', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))

        await pg.set_viewport_size({'width': 390, 'height': 800})
        await pg.evaluate("wOpenDcup()"); await pg.wait_for_selector('#modalBox .wdcb')
        await pg.screenshot(path='/tmp/realm-dcup-phone.png')
        check(await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), 'the bracket fits a phone')

        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm diamond cup passed')

asyncio.run(main())
