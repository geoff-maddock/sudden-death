# Realm regional fans (epic 2, phase 8): your name, region by region. A win in a region adds to it, a cup and a
# contract more, a loss takes a little. Known (10): rooms at its inn a quarter less. Liked (25): half price, and its
# free agents a level higher at the same fee. Loved (50): a home crowd at every match in the region (Block at
# kickoff), but not twice at your own ground. The Team screen shows it, the save keeps it, How to play explains it.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-name-*.png.
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
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_REP !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- earning it ----------
        earn = await pg.evaluate("""(() => { const W = (k, r) => ({ kind: k, region: r, ref: null, tier: 1 });
          (RUN.games = RUN.games || []).push({ sport: 'baseball', won: true, us: 1, them: 0, type: 'normal' }); wDispatchEnd(W('wild', 'tide'), 'win'); const a = wRep('tide');
          wDispatchEnd(W('wild', 'tide'), 'lose'); const b = wRep('tide');
          wCupWon('salt'); const c = wRep('tide');
          wNoticePayOut(Object.assign(wMakeNotice('saltmere', 'sport'), { until: WG.dayAbs + 7 })); WG.cardOffer = null; const d = wRep('tide');
          return { a, b, c, d, step: wRepStep('tide'), name: wRepName('tide'), log: WLOG.slice(-6).map(l => l[0]).join(' ') }; })()""")
        check(earn['a'] == 1 and earn['b'] == 0, 'a win adds 1, a loss takes 1', earn)
        check(earn['c'] == 10 and earn['d'] == 13, 'a cup adds 10, a contract 3', earn)
        check(earn['step'] == 1 and earn['name'] == 'Known' and 'Known' in earn['log'], 'at 10 you are Known, and the log says what it buys', earn)

        # ---------- the inn: a quarter off, then half ----------
        await pg.evaluate(CLOSE_ALL)
        inn = await pg.evaluate("""(() => { wEnterMap('saltmere', MAPS.saltmere.spawn[0], MAPS.saltmere.spawn[1]); wOpenInn(12, 'The innkeeper');
          const t = document.getElementById('modalBox').textContent, btn = document.getElementById('wSleep').textContent; return { t, btn }; })()""")
        check('9 gold' in inn['btn'] and 'not 12' in inn['t'] and 'Known' in inn['t'], 'Known: the room costs a quarter less, and the inn says why', inn)
        await pg.screenshot(path='/tmp/realm-name-inn.png')
        await pg.evaluate(CLOSE_ALL)
        g0 = await pg.evaluate("(() => { RUN.gold = 100; return RUN.gold; })()")
        await pg.evaluate("wOpenInn(12, 'The innkeeper')"); await pg.click('#wSleep')
        check(await pg.evaluate("RUN.gold") == g0 - 9, 'and you pay the lower price', await pg.evaluate("RUN.gold"))
        await pg.evaluate(CLOSE_ALL)

        # ---------- Liked: half price and better agents; Mossgate unchanged ----------
        lk = await pg.evaluate("""(() => { WG.rep.tide = 25; WG.tavern = {}; const plain = wTavern('mossgate').list.map(a => [a.lvl, a.fee]);
          const T = wTavern('saltmere'); return { step: wRepStep('tide'), price: wInnPrice(12, 'tide'), agents: T.list.map(a => [a.lvl, a.fee, wFee(a.lvl - 1)]), boosted: T.wrep, again: wTavern('saltmere').list.map(a => a.lvl), plain }; })()""")
        check(lk['step'] == 2 and lk['price'] == 6, 'Liked: rooms half price', lk)
        check(lk['boosted'] == 1 and all(a[1] == a[2] for a in lk['agents']) and lk['again'] == [a[0] for a in lk['agents']], 'and the free agents are a level higher at the same fee, once', lk)

        # ---------- Loved: a home crowd ----------
        lv = await pg.evaluate("""(() => { WG.rep.tide = 50; const L = DB.locs.find(l => l.map === 'saltmere'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60;
          WG.wx = { day: WG.dayAbs, by: {} }; wWildMatch('tide'); const e = document.querySelector('#modalBox .wrep'); return { step: wRepStep('tide'), pre: e ? e.textContent : '' }; })()""")
        check(lv['step'] == 3 and 'Loved' in lv['pre'] and 'Block' in lv['pre'], 'Loved: the pre-game card promises a home crowd', lv)
        await pg.screenshot(path='/tmp/realm-name-pregame.png')
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        crowd = await pg.evaluate("({ blk: B.P.block, rep: B.wRep || 0 })")
        check(crowd['rep'] == 1 and crowd['blk'] >= 4, 'and the crowd brings Block at kickoff', crowd)
        await pg.evaluate("(() => { B.over = 'lose'; B.forfeit = 1; finishFight(); })()")
        await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        home = await pg.evaluate("""(() => { WG.ground = { town: 'saltmere', grd: wGrdsOf('saltmere')[0].id, parts: {}, drills: {} };
          const a = wRepCrowd({ kind: 'wild', region: 'tide' }), b = wRepCrowd({ kind: 'wild', region: 'rime' }); WG.ground = null; return { a, b }; })()""")
        check(home == {'a': False, 'b': False}, 'not twice at home, and not where you are not Loved', home)

        # ---------- the Team screen, the save, How to play ----------
        await pg.evaluate("wOpenCamp()"); await pg.wait_for_timeout(300)
        team = await pg.evaluate("(() => { const l = document.querySelector('#modalBox .wreplist'); return l ? l.textContent : ''; })()")
        check('Brinefen' in team and 'Loved' in team and 'Charter Plains' in team, 'the Team screen shows your name in every region', team)
        await pg.evaluate("document.querySelector('#modalBox .wreplist').scrollIntoView()")
        await pg.screenshot(path='/tmp/realm-name-team.png')
        await pg.evaluate(CLOSE_ALL)
        rep = await pg.evaluate("(() => { wSave(); return JSON.stringify(WG.rep); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("JSON.stringify(WG.rep)") == rep, 'the save keeps your name')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpName'); return h ? h.textContent : ''; })()")
        check('Known' in help_ and 'Liked' in help_ and 'Loved' in help_, 'How to play explains your name in the regions', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm name passed')

asyncio.run(main())
