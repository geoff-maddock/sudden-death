"""What a following does in the card game (issue #79, phase 2). The gate: at every card match at a ground your fans pay
in 1 gold for every 25 of them, capped, doubled at home, win or lose. The away end: 3 Block at kickoff away from home,
not on top of a Loved crowd, not at home. Neither in LAB mode unless the lab asks."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:500])
    else:
        print('ok', what)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wFanGate === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the gate ----------
        g = await pg.evaluate("""(() => { const W = { kind: 'ground', region: 'tide', ref: { g: 'g_rink', mode: 'friendly' } }, at = (n, w) => { RUN.fans = n; return wFanGate(w || W); };
          WG.ground = null; const away = [0, 99, 100, 160, 250, 499, 500, 899, 900, 1000, 3000].map(n => at(n));
          const wild = at(600, { kind: 'wild', region: 'tide' });
          WG.ground = { town: 'saltmere', parts: {} }; const homeReg = wHomeRegion(), home = at(250, { kind: 'ground', region: homeReg }), notHome = at(250, { kind: 'ground', region: homeReg === 'tide' ? 'rime' : 'tide' }); WG.ground = null;
          LAB = true; let lab, asked; try { lab = at(600); W_FOLLOW.lab = true; asked = at(600); } finally { LAB = false; W_FOLLOW.lab = false; }
          W_FOLLOW.off = true; const off = at(600); W_FOLLOW.off = false;
          return { away, wild, home, notHome, lab, asked, off, R: W_FANS }; })()""")
        check(g['away'] == [0, 0, 4, 6, 10, 19, 20, 20, 30, 30, 30] and g['R']['cap'] == 20 and g['R']['big'] == 1.5, 'the gate is 1 gold for every 25 fans, up to 20 a match, half as much again with a travelling army', g)
        check(g['wild'] == 0 and g['home'] == 20 and g['notHome'] == 10, 'only at a ground, and doubled where the match is at home', g)
        check(g['lab'] == 0 and g['asked'] == 20 and g['off'] == 0, 'not in LAB mode unless the lab asks, and off with the following', g)
        pay = await pg.evaluate("""(() => { RUN.fans = 250; const W = { kind: 'ground', region: 'tide', tier: 1, ref: { g: 'g_rink', mode: 'friendly' } }, logs = () => WLOG.map(l => l[0]);
          const g0 = RUN.gold, n0 = logs().length; wDispatchEnd(W, 'lose'); const lost = RUN.gold - g0, line = logs().slice(n0).find(t => t.includes('Your fans at the gate')) || '';
          const g1 = RUN.gold; wDispatchEnd({ kind: 'wild', region: 'tide', tier: 1 }, 'lose'); return { lost, line, wild: RUN.gold - g1 }; })()""")
        check(pay['lost'] == 10 and '10 gold' in pay['line'] and pay['wild'] == 0, 'a lost match at a ground still pays the fans gate; a match elsewhere pays none', pay)

        # ---------- the away end ----------
        a = await pg.evaluate("""(() => { const W = { kind: 'wild', region: 'tide' }; WG.ground = null; WG.rep = {};
          RUN.fans = 399; const few = wFanAway(W); RUN.fans = 400; const club = wFanAway(W);
          WG.rep.tide = 50; const loved = wFanAway(W); WG.rep = {};
          WG.ground = { town: 'saltmere', parts: {} }; const home = wFanAway({ kind: 'wild', region: wHomeRegion() }); WG.ground = null;
          return { few, club, loved, home }; })()""")
        check(a == {'few': False, 'club': True, 'loved': False, 'home': False}, 'the away end needs a supporters club, and is not on top of a Loved crowd or at home', a)
        pre = await pg.evaluate("""(() => { RUN.fans = 420; WG.rep = {}; WG.ground = null; const L = DB.locs.find(l => l.map === 'saltmere'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60;
          WG.wx = { day: WG.dayAbs, by: {} }; wWildMatch('tide'); const e = document.querySelector('#modalBox .wfansline'); return e ? e.textContent : ''; })()""")
        check("A supporters' club" in pre and '3 Block at kickoff' in pre and 'gate' not in pre, 'the pre-game card says your fans have travelled', pre)
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        k = await pg.evaluate("({ blk: B.P.block, away: B.wAway || 0, plain: JSON.stringify(B).length > 0 })")
        check(k['away'] == 1 and k['blk'] >= 3 and k['plain'], 'and they bring 3 Block at kickoff', k)

        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpFanGate'); return h ? h.textContent : ''; })()")
        check('The gate' in hp and 'win or lose' in hp and 'The away end' in hp and '3 Block' in hp, 'How to play explains the gate and the away end', hp)
        live = await pg.evaluate("W_FOLLOW.live")
        check(live[1] and live[2], 'the first two steps are marked as in the game', live)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
