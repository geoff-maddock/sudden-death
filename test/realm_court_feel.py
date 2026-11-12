# Realm court feel (issue #77, phase 11). The coach's notes: Basketball once your team has three players, the Charter
# Net once you have won a basketball game. Sound on the court: the rim, the crowd and the whistle through a game, from
# the engine's events (wBK.onEv), nothing with Sound effects off, and none from a game simulated behind the scenes.
# Medals: a basketball game won and a Charter Net won count, and both are in the book. How to play. Asserts; exits
# nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wCourtOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wCourtTips === 'function'"); await pg.evaluate("wBK.speed = 8")  # the court at 8 steps a frame: the same game, sooner
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS).filter(k => k !== 'w_court' && k !== 'w_net')); SET.tips = true")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- the coach's notes ----------
        await pg.wait_for_function("tipQ.includes('w_court') || TIPS_SEEN.includes('w_court')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Basketball' in coach and 'Court tab' in coach and 'HOOPS' in coach, "with three players, a coach's note says how to play basketball", coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')
        check(not await pg.evaluate("TIPS_SEEN.includes('w_net') || tipQ.includes('w_net')"), 'no Charter Net note before a basketball game is won')

        # ---------- sound on the court ----------
        await pg.evaluate("SET.sfx = true; SND.on = true")
        await pg.evaluate(SPY)
        await pg.evaluate("wStartCourt({ club: 'local', how: 'manage' })")
        await pg.wait_for_function("UI.view === 'court' && wBK.live", timeout=30000)
        await pg.evaluate("wBK.setMode('watch')")
        await pg.wait_for_function("(window.__snd.block || 0) >= 2 && (window.__snd.coin || 0) + (window.__snd.card || 0) + (window.__snd.crunch || 0) >= 2", timeout=60000)
        s = await pg.evaluate("__snd")
        check(set(s) <= {'block', 'coin', 'card', 'crunch', 'crowd', 'hit', 'magic', 'crit', 'whistle', 'horn'} and s.get('crowd', 0) + s.get('card', 0) >= 1, 'the play makes its sounds: the rim, baskets, steals, the crowd', s)
        ev = await pg.evaluate("""(() => { window.__snd = {}; const G = wBK.G, c = G.cur, you = wBK.you; const say = (k, o, side) => { G.cur = Object.assign({}, c, { side }); wBK.onEv({ k, s: 'x', o }); };
          say('shot', 'dunk', you); say('made', 2, you); const dunk = Object.assign({}, __snd); window.__snd = {};
          say('shot', 'jumper', 1 - you); say('made', 2, 1 - you); const theirs = Object.assign({}, __snd); window.__snd = {};
          say('ult', '', you); say('roar', '', you); say('timeout', '', you); const rest = Object.assign({}, __snd); G.cur = c; window.__snd = {}; return { dunk, theirs, rest }; })()""")
        check(ev['dunk'] == {'crunch': 1, 'crowd': 1} and ev['theirs'] == {'card': 1} and ev['rest'] == {'crit': 1, 'crowd': 1, 'whistle': 1}, 'your dunk brings the crowd, their basket does not; an ultimate, the roar and a timeout each have a sound', ev)
        quiet = await pg.evaluate("(() => { window.__snd = {}; const club = Object.values(WG.rivals)[0]; wCourtSimClubs(club, 'local', 1); const n = Object.keys(__snd).length; return { n, hook: typeof wBK.onEv }; })()")
        check(quiet == {'n': 0, 'hook': 'function'}, 'a game simulated behind the scenes makes no sound, and the court keeps its sounds after it', quiet)
        n0 = await pg.evaluate("(() => { SET.sfx = false; window.__snd = {}; window.__evs = 0; const f = wBK.onEv; wBK.onEv = e => { __evs++; f(e); }; window.__evOff = () => { wBK.onEv = f; }; return 0; })()")
        await pg.wait_for_function("window.__evs >= 12", timeout=30000)
        q = await pg.evaluate("(() => { __evOff(); return { snd: Object.keys(__snd).length, evs: __evs }; })()")
        check(q['snd'] == 0 and q['evs'] >= 12, 'with Sound effects off, the court is quiet while the play goes on', q)
        await pg.evaluate("SET.sfx = true")

        # ---------- medals: a game won ----------
        w0 = await pg.evaluate("ACHS.stats.realmCourtWins || 0")
        await pg.evaluate("(() => { const G = wBK.G; G.q = 4; G.clock = 1; G.score = [40, 0]; const end = wBK.onOver; wBK.onOver = s => { window.__snd = {}; end(s); window.__end = Object.assign({}, __snd); wBK.onOver = end; }; })()")
        await pg.wait_for_function("wBK.phase === 'over' && !WG.bkg.live", timeout=60000)
        s = await pg.evaluate("window.__end")
        check(s.get('horn') == 1 and s.get('crowd') == 1 and 'bad' not in s, 'a win ends with the horn and the crowd', s)
        check(await pg.evaluate("WG.bkg.games[0].r") == 'win' and await pg.evaluate("ACHS.stats.realmCourtWins || 0") == w0 + 1, 'a won basketball game counts for the Court Vision medal')
        await pg.click('#wCourtBack'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)
        await pg.wait_for_function("tipQ.includes('w_net') || TIPS_SEEN.includes('w_net')", timeout=5000)
        coach = await pg.evaluate("(document.getElementById('coach') || {}).textContent || ''")
        check('Charter Net' in coach and 'NET' in coach, 'after a win, a coach\'s note points to the Charter Net', coach)
        if await pg.evaluate("!!document.getElementById('cOk')"): await pg.click('#cOk')

        # ---------- medals: a cup won ----------
        d0 = await pg.evaluate("ACHS.stats.realmNets || 0")
        await pg.evaluate("(() => { RUN.gold = 500; wNetEnter(); WG.bkcup.round = 2; WG.bkcup.games = [[{ a: 'me', b: WG.bkcup.field[1], ra: 30, rb: 20, w: 'me' }], [{ a: 'me', b: WG.bkcup.field[2], ra: 30, rb: 20, w: 'me' }], [{ a: 'me', b: WG.bkcup.field[4], ra: 31, rb: 27, w: 'me' }]]; wNetWon(); })()")
        check(await pg.evaluate("ACHS.stats.realmNets || 0") == d0 + 1 and await pg.evaluate("ACH.some(a => a.id === 'w_net') && ACH.some(a => a.id === 'w_court')"), 'a won Charter Net counts for its medal; both medals are in the book')
        await pg.evaluate(CLOSE_ALL)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpCourtFeel'); return h ? h.textContent : ''; })()")
        check('Sound effects' in help_ and 'medals' in help_, 'How to play mentions the sound and the medals', help_)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
