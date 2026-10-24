# Realm ball games (issue #4, phase 4): a new journey (three founders) can't play a ball game: the Nine tab says how
# many more players to recruit, and its Play a game button is off. With five players it can. Simulate against the
# local nine settles at once: a result card, the game in WG.ball, box lines for your own players only (not call-ups),
# XP for the nine, gold and fans for a win, and the same club refuses a second game that day. Play against a rival
# from the card puts the game on the diamond with your keys (Space throws a pitch or swings), Save and leave goes back
# to the world with the game kept, a reload asks to resume it, and Resume puts the same game back on the field; its
# final records the head to head (baseball) and the Stats tab's Baseball view. Concede is a loss; Brimstone
# Diamond's End game calls a game off with no result. The home ground can host a game. How to play explains it.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-ball-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

SR = "document.getElementById('v-diamond').shadowRoot"
STATE = """(() => { const B = WG.ball || {}; return { live: !!B.live, snap: !!(B.live && B.live.snap), games: (B.games || []).length, w: B.w || 0, l: B.l || 0,
  met: B.met || {}, view: UI.view, gold: RUN.gold, fans: RUN.fans || 0, xp: WG.roster.map(p => [p.lvl, p.xp]), bstats: Object.keys(WG.bstats || {}) }; })()"""

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStartBall === 'function'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def open_nine(pg):
    await pg.evaluate("wOpenCamp('nine')"); await pg.wait_for_selector('#wCampBody [data-nwatch]')

async def close_modal(pg):
    await pg.evaluate("!document.getElementById('modal').hidden && document.querySelector('#modalBox [data-close]') && document.querySelector('#modalBox [data-close]').click()")
    await pg.wait_for_function("document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await boot(pg); await new_journey(pg)

        # ---------- not enough players ----------
        probs = await pg.evaluate("wBallProblems()")
        check(len(probs) == 1 and 'Recruit 2 more players' in probs[0], 'three founders: recruit 2 more before a ball game', probs)
        await open_nine(pg)
        nine = await pg.evaluate("(() => { const b = document.querySelector('#wCampBody [data-nplay]'), h = document.querySelector('#wCampBody .wball'); return { play: !!b, off: b && b.disabled, hint: h ? h.textContent : '' }; })()")
        check(nine['play'] and nine['off'] and 'Recruit 2 more' in nine['hint'], 'the Nine tab says so, and Play a game is off', nine)
        check(await pg.evaluate("wStartBall({ club: 'local', how: 'sim' })").__await__ if False else 'Recruit' in await pg.evaluate("wStartBall({ club: 'local', how: 'sim' })"), 'and wStartBall refuses')
        await close_modal(pg)

        await pg.evaluate("wRecruit({ kind: 'troll', lvl: 2 }, 'tavern'); wRecruit({ kind: 'harpy', lvl: 2 }, 'tavern'); wDrain()")
        await pg.wait_for_timeout(200); await pg.evaluate("WG.cardOffer = null; document.getElementById('modal').hidden || document.querySelector('#modalBox [data-close], #modalBox button') && null")
        await pg.evaluate("while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox .btn, #modalBox button'); if (!b) break; b.click(); }")
        check(await pg.evaluate("wRoster().length === 5 && wBallProblems().length === 0"), 'five players: nothing in the way')

        # ---------- simulate against the local nine ----------
        s0 = await pg.evaluate(STATE)
        r = await pg.evaluate("wStartBall({ club: 'local', how: 'sim' })")
        s1 = await pg.evaluate(STATE)
        check(r == '' and s1['games'] == 1 and not s1['live'] and s1['view'] == 'world', 'Simulate settles a game at once, in the world', {'r': r, 's': s1})
        card = await pg.evaluate("(() => { const b = document.getElementById('wBallOk'); return b ? document.getElementById('modalBox').textContent : ''; })()")
        check('Final:' in card, 'a result card says the final', card)
        await pg.screenshot(path='/tmp/realm-ball-sim.png')
        await pg.click('#wBallOk')
        g = await pg.evaluate("WG.ball.games[0]")
        ids = await pg.evaluate("WG.roster.map(p => p.id)")
        check(s1['bstats'] and all(int(k) in ids for k in s1['bstats']), 'box lines only for your own players', s1['bstats'])
        check(all(int(k) in ids for k in g['line']) and isinstance(g['us'], int) and g['club'] == 'local', 'the game keeps its score and lines', g)
        check(s1['xp'] != s0['xp'], 'the nine gets XP', [s0['xp'], s1['xp']])
        if g['r'] == 'win':
            check(s1['gold'] > s0['gold'] and s1['fans'] > s0['fans'], 'a win pays gold and fans', [s0['gold'], s1['gold']])
        else:
            check(s1['gold'] == s0['gold'], 'a loss costs no gold', [s0['gold'], s1['gold']])
        again = await pg.evaluate("wStartBall({ club: 'local', how: 'sim' })")
        check('already played you today' in again, 'the same club refuses a second game that day', again)

        # ---------- play a rival from the card ----------
        await pg.evaluate("while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox [data-close], #modalBox .btn'); if (!b) break; b.click(); }")
        await open_nine(pg)
        await pg.click('#wCampBody [data-nplay]'); await pg.wait_for_selector('#modalBox .wbclubs')
        rows = await pg.evaluate("[...document.querySelectorAll('#modalBox .wbcl')].map(li => ({ t: li.textContent, off: [...li.querySelectorAll('button')].every(b => b.disabled) }))")
        check(len(rows) >= 3 and rows[0]['off'] and not any(r['off'] for r in rows[1:]), 'the card: the local nine (played today) and the rivals', rows)
        await pg.screenshot(path='/tmp/realm-ball-card.png')
        club = await pg.evaluate("document.querySelectorAll('#modalBox [data-bhow=\"play\"]')[1].dataset.bclub")
        await pg.evaluate("document.querySelectorAll('#modalBox [data-bhow=\"play\"]')[1].click()")
        await pg.wait_for_function("UI.view === 'diamond' && WG.ball.live && wBD.G.phase === 'plate'", timeout=15000)
        bar = await pg.evaluate("({ save: !document.getElementById('wBallSave').hidden, give: !document.getElementById('wBallGive').hidden, back: !document.getElementById('wDiamondBack').hidden, ctl: wBD.G.teams.map(t => t.ctl), note: document.getElementById('wDiamondNote').textContent })")
        check(bar['save'] and bar['give'] and not bar['back'] and bar['ctl'] == ['p1', 'cpu'], 'on the diamond: you bat first, Save and leave and Concede on the bar', bar)
        pitches = 0
        for i in range(14):
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
        cnt = await pg.evaluate("({ b: wBD.G.balls, s: wBD.G.strikes, o: wBD.G.outs, h: wBD.G.teams[0].H })")
        check(cnt['b'] + cnt['s'] + cnt['o'] + cnt['h'] > 0, 'your keys play: the count moves', cnt)
        await pg.wait_for_function("WG.ball.live && !!WG.ball.live.snap")
        await pg.screenshot(path='/tmp/realm-ball-play.png')
        await pg.click('#wBallSave'); await pg.wait_for_function("UI.view === 'world'")
        kept = await pg.evaluate("(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())); return { live: !!s.WG.ball.live, snap: !!(s.WG.ball.live && s.WG.ball.live.snap), inn: s.WG.ball.live && s.WG.ball.live.snap.inning, outs: s.WG.ball.live && s.WG.ball.live.snap.outs }; })()")
        check(kept['live'] and kept['snap'], 'Save and leave: back in the world, the game in the save', kept)

        # ---------- reload, and resume ----------
        await pg.reload(); await pg.wait_for_function("typeof wStartBall === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bResume'); await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.wait_for_selector('#wBallRes', timeout=5000)
        check(True, 'after a reload, a game is waiting')
        await pg.click('#wBallRes')
        try: await pg.wait_for_function("UI.view === 'diamond' && wBD.live", timeout=15000)
        except Exception: print('DEBUG', await pg.evaluate("({ view: UI.view, live: wBD.live, ph: wBD.G.phase, wd: !!WD, errs: window.__sdErrs })"), errs); raise
        back = await pg.evaluate("({ inn: wBD.G.inning, outs: wBD.G.outs, ctl: wBD.G.teams.map(t => t.ctl), opp: wBD.G.teams[1].def.name })")
        check(back['inn'] == kept['inn'] and back['outs'] == kept['outs'] and back['ctl'][0] == 'p1', 'Resume: the same game, where it was', [kept, back])
        # play it out: both sides on the CPU, then the final
        await pg.evaluate("wBD.G.teams.forEach(t => t.ctl = 'cpu'); wBD.simToEnd(true)")
        await pg.wait_for_function("!WG.ball.live && !document.getElementById('wDiamondBack').hidden")
        fin = await pg.evaluate("({ note: document.getElementById('wDiamondNote').textContent, h: WG.h2h[" + json.dumps(club) + "], games: WG.ball.games.length })")
        check('Final:' in fin['note'] and fin['games'] == 2 and fin['h']['last']['sport'] == 'baseball', 'the final: on the bar, in the head to head as baseball', fin)
        await pg.screenshot(path='/tmp/realm-ball-final.png')
        await pg.click('#wDiamondBack'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox .btn, #modalBox [data-close]'); if (!b) break; b.click(); }")

        # ---------- the Stats tab ----------
        await pg.evaluate("wOpenCamp('stats')"); await pg.wait_for_selector('[data-wsview="baseball"]')
        await pg.click('[data-wsview="baseball"]')
        st = await pg.evaluate("(() => { const t = document.querySelector('#wCampBody table.wstats'); return { head: [...t.querySelectorAll('thead th')].map(th => th.textContent), rows: t.querySelectorAll('tbody tr').length }; })()")
        check('AVG' in st['head'] and 'ERA' in st['head'] and st['rows'] == 5, 'the Stats tab has a Baseball view', st)
        await pg.click('#wCampBody [data-wsort="ab"]')
        pid = await pg.evaluate("Object.keys(WG.bstats)[0]")
        await pg.evaluate(f"document.querySelector('#wCampBody tr[data-wsp=\"{pid}\"] [data-wsp-open]').click()")
        box = await pg.evaluate("(() => { const b = document.querySelector('#wCampBody .wbdbox'); return b ? b.textContent : ''; })()")
        check('ball game' in box and 'AVG' in box, "a player's stats show their box line", box)
        await pg.screenshot(path='/tmp/realm-ball-stats.png')
        await close_modal(pg)

        # ---------- concede, and End game ----------
        clubs = await pg.evaluate("wBallClubs().filter(c => WG.ball.met[c] !== WG.dayAbs)")
        await pg.evaluate(f"wStartBall({{ club: {json.dumps(clubs[0])}, how: 'manage' }})")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase === 'plate'", timeout=15000)
        check(await pg.evaluate("wBD.G.rules.auto === true && wBD.G.rules.injuries === false && wBD.G.rules.brawl === false"), 'Manage turns on Auto powers; the Realm rules are on')
        await pg.wait_for_function("!!WG.ball.live.snap")
        l0 = await pg.evaluate("WG.ball.l")
        await pg.click('#wBallGive'); await pg.wait_for_selector('#cfYes')
        check(await pg.evaluate("wBD.G.paused === true"), 'the game stops while you decide to concede')
        await pg.click('#cfNo'); await pg.wait_for_function("document.getElementById('modal').hidden")
        f = await pg.evaluate("({ paused: wBD.G.paused, focus: document.getElementById('wDiamondBar').contains(document.activeElement) })")
        check(f == {'paused': False, 'focus': False}, 'Cancel: the game goes on, and Space goes to the field, not the Concede button', f)
        await pg.click('#wBallGive'); await pg.wait_for_selector('#cfYes'); await pg.click('#cfYes')
        await pg.wait_for_function("UI.view === 'world' && !WG.ball.live")
        check(await pg.evaluate("WG.ball.l") == l0 + 1 and await pg.evaluate("WG.ball.games[0].r") == 'lose', 'Concede is a loss')
        await pg.evaluate("while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox .btn, #modalBox [data-close]'); if (!b) break; b.click(); }")
        await pg.evaluate(f"wStartBall({{ club: {json.dumps(clubs[1])}, how: 'play' }})")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase !== 'menu'", timeout=15000)
        n0 = await pg.evaluate("WG.ball.games.length")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        await pg.evaluate(SR + ".getElementById('bQuit').click()"); await pg.wait_for_timeout(150)
        await pg.evaluate(SR + ".querySelector('[data-end=\"wipe\"]').click()")
        await pg.wait_for_function("UI.view === 'world'")
        off = await pg.evaluate(f"({{ live: !!WG.ball.live, games: WG.ball.games.length, met: WG.ball.met[{json.dumps(clubs[1])}] }})")
        check(not off['live'] and off['games'] == n0 and off['met'] is None, "its End game calls the game off: no result, and they can play you again", off)

        # ---------- the home ground, and How to play ----------
        await pg.evaluate("while (!document.getElementById('modal').hidden) { const b = document.querySelector('#modalBox .btn, #modalBox [data-close]'); if (!b) break; b.click(); }")
        await pg.evaluate("RUN.gold += 500; wBuyGround('graftonbury'); wEnterMap('graftonbury', 5, 11); wOpenGround('graftonbury')")
        check(await pg.evaluate("!!document.getElementById('wGroundBall')"), 'your ground can host a ball game')
        await pg.click('#wGroundBall'); await pg.wait_for_selector('#modalBox .wbclubs')
        check('Host a ball game' in await pg.evaluate("document.querySelector('#modalBox h3').textContent"), 'and opens the card as the home side')
        await close_modal(pg)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpBall'); return h ? h.textContent : ''; })()")
        check('5 players of your own' in help_ and 'Save and leave' in help_, 'How to play explains ball games', help_)

        # ---------- a phone ----------
        await pg.set_viewport_size({'width': 390, 'height': 800})
        clubs2 = await pg.evaluate("wBallClubs().filter(c => WG.ball.met[c] !== WG.dayAbs)")
        await pg.evaluate(f"wStartBall({{ club: {json.dumps(clubs2[0])}, how: 'play' }})")
        await pg.wait_for_function("UI.view === 'diamond' && wBD.G.phase !== 'menu'", timeout=15000)
        await pg.wait_for_timeout(300)
        bfit = await pg.evaluate("(() => { const b = document.getElementById('wDiamondBar').getBoundingClientRect(); return document.documentElement.scrollWidth <= window.innerWidth + 1 && b.right <= window.innerWidth + 1; })()")
        await pg.screenshot(path='/tmp/realm-ball-phone-bar.png')
        check(bfit, 'the bar fits a phone during a game')
        await pg.click('#wBallSave'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate("wOpenBallCard()"); await pg.wait_for_selector('#modalBox .wbclubs')
        fit = await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        await pg.screenshot(path='/tmp/realm-ball-phone.png')
        check(fit, 'the card fits a phone')

        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm ball games passed')

asyncio.run(main())
