# Realm gate money (issue #6, open question 4): a game at a ground costs nothing, and a win takes the gate on top of
# the match's rewards: W_TAKE.per gold a tier (Friendly, Challenge), times your name in the region. A loss takes none,
# and the Ballpark's ball games keep their own purse. Checks the numbers, the keeper's card, the pre-game card, a real
# win at the Pond Rink, a loss, and How to play.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-gate-*.png.
import asyncio, json, sys, os, math
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
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 80) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .4)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
KINDS = ['troll', 'harpy', 'golem', 'wraith', 'spider']

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_TAKE !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(f"(() => {{ const K = {json.dumps(KINDS)}; let i = 0; while (wRoster().length < 7 && i < 10) wRecruit({{ kind: K[i++ % K.length], lvl: 2 }}, 'tavern'); }})()")
        await pg.evaluate(CLOSE_ALL)

        # ---------- the numbers ----------
        n = await pg.evaluate("""(() => { const reg = W_GRD_REG[wGrd('g_rink').city], out = {};
          for (const [k, pts] of [['unknown', 0], ['known', 10], ['liked', 25], ['loved', 50]]) { WG.rep = { [reg]: pts }; out[k] = [wTake('g_rink', 'friendly'), wTake('g_rink', 'challenge')]; }
          WG.rep = {}; out.tiers = [wGrdTier('g_rink', 'friendly'), wGrdTier('g_rink', 'challenge')]; out.ball = wTake(W_GRDS.find(g => g.sport === 'baseball').id, 'friendly');
          out.court = [wGrdTier('g_court', 'friendly'), wTake('g_court', 'friendly')]; return out; })()""")
        t = n['tiers']
        rnd = lambda x: math.floor(x + .5)  # JS Math.round, not Python's round-half-even
        check(n['unknown'] == [5 * t[0], 6 * t[1]], 'the gate is 5 gold a tier for a Friendly and 6 for a Challenge', n)
        check(n['known'] == [rnd(5 * t[0] * 1.25), rnd(6 * t[1] * 1.25)] and n['liked'] == [rnd(5 * t[0] * 1.5), rnd(6 * t[1] * 1.5)] and n['loved'] == [10 * t[0], 12 * t[1]],
              'your name in the region brings a bigger crowd: a quarter more, half again, double', n)
        check(n['ball'] == 0 and n['court'] == [1, 5], 'the Ballpark keeps its own purse; a tier-1 Friendly in the Charter Plains takes 5', n)

        # ---------- the keeper's card and the pre-game card ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_rink'); wEnterMap('world', L.x, L.y + 1); wTryMove(0, -1); wDrain(); })()")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wOpenGrdCard('g_rink')")
        card = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wgate'); return e ? e.textContent : ''; })()")
        check('No fee' in card and f"{n['unknown'][0]} gold for the Friendly" in card and f"{n['unknown'][1]} gold for the Challenge" in card, 'the keeper\'s card: no fee, and what a win takes', card)
        await pg.screenshot(path='/tmp/realm-gate-card.png')
        await pg.click('[data-gplay="friendly"]'); await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wpground'); return e ? e.textContent : ''; })()")
        check(f"the gate is {n['unknown'][0]} gold" in pre, 'the pre-game card says what the gate is', pre)

        # ---------- a win takes the gate; a loss takes none ----------
        await pg.click('#wPlay'); await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the Friendly is won', view)
        g0 = await pg.evaluate("RUN.gold")
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        won = await pg.evaluate(f"({{ gold: RUN.gold, log: WLOG.slice(-12).map(l => l[0]).join(' ') }})")
        check(f"The gate at the Pond Rink: {n['unknown'][0]} gold" in won['log'] and 'at The Pond' not in won['log'] and won['gold'] - g0 >= n['unknown'][0], 'a win takes the gate, with a line in the log', [g0, won])
        await pg.evaluate(CLOSE_ALL)
        lose = await pg.evaluate("""(() => { const g0 = RUN.gold, n0 = WLOG.length; W_ON_END.ground('lose', { g: 'g_rink', mode: 'friendly' }, {});
          return { gold: RUN.gold - g0, log: WLOG.slice(n0).map(l => l[0]).join(' ') }; })()""")
        check(lose['gold'] == 0 and 'gate' not in lose['log'], 'a loss takes no gate', lose)
        off = await pg.evaluate("(() => { W_TAKE.off = true; const v = wTake('g_rink', 'friendly'); W_TAKE.off = false; return v; })()")
        check(off == 0, 'W_TAKE.off turns the gate off (for the bot)', off)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGate'); return h ? h.textContent : ''; })()")
        check('costs nothing' in help_ and 'gate' in help_ and 'Loved' in help_, 'How to play explains the gate', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm gate passed')

asyncio.run(main())
